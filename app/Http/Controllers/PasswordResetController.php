<?php

namespace App\Http\Controllers;

use App\Mail\PasswordResetOTPMail;
use App\Mail\PasswordResetSuccessMail;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

/**
 * PasswordResetController
 *
 * Handles secure password reset functionality with OTP verification.
 *
 * Security Features:
 * - Rate limiting to prevent abuse
 * - 6-digit OTP with 15-minute expiration
 * - Maximum 5 verification attempts
 * - Secure password hashing with bcrypt/Argon2
 * - No sensitive information disclosure
 * - Audit logging for security events
 */
class PasswordResetController extends Controller
{
    /**
     * OTP expiration time in minutes.
     */
    private const OTP_EXPIRY_MINUTES = 15;

    /**
     * Maximum number of OTP verification attempts allowed.
     */
    private const MAX_ATTEMPTS = 5;

    /**
     * Maximum password reset requests per hour per IP.
     */
    private const MAX_REQUESTS_PER_HOUR = 5;

    /**
     * Send a password reset OTP to the user's email.
     *
     * This endpoint:
     * 1. Validates the email format
     * 2. Checks rate limiting
     * 3. Generates a secure 6-digit OTP
     * 4. Stores the hashed OTP with expiration
     * 5. Sends the OTP via email
     *
     * Security: Always returns success message to prevent email enumeration.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function sendResetOTP(Request $request): JsonResponse
    {
        // Validate email format
        $request->validate([
            'email' => 'required|email|max:255',
        ]);

        $email = strtolower(trim($request->email));
        $ipAddress = $request->ip();

        // Rate limiting: Max 5 requests per hour per IP
        $rateLimitKey = 'password_reset:' . $ipAddress;

        if (RateLimiter::tooManyAttempts($rateLimitKey, self::MAX_REQUESTS_PER_HOUR)) {
            $seconds = RateLimiter::availableIn($rateLimitKey);

            Log::warning('Password reset rate limit exceeded', [
                'ip' => $ipAddress,
                'email' => $email,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Too many requests. Please try again in ' . ceil($seconds / 60) . ' minutes.',
            ], 429);
        }

        // Increment rate limiter
        RateLimiter::hit($rateLimitKey, 3600); // 1 hour window

        // Check if user exists (we don't reveal if email exists)
        // For admins, also check by personal_gmail since they may enter that instead
        $user = User::whereRaw('LOWER(email) = ?', [$email])->first();

        // If not found by work email, check if an admin entered their personal_gmail
        if (!$user) {
            $user = User::whereRaw('LOWER(personal_gmail) = ?', [$email])
                ->whereRaw('LOWER(role) = ?', ['admin'])
                ->first();
        }

        // Generate OTP and token regardless of user existence
        $otp = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $token = Str::random(64);
        $expiresAt = Carbon::now()->addMinutes(self::OTP_EXPIRY_MINUTES);

        // Determine which email to send OTP to
        $sendToEmail = null;
        $isAdmin = false;

        if ($user) {
            $isAdmin = strtolower($user->role ?? '') === 'admin';

            // For admins, use personal_gmail; for others, use work email
            if ($isAdmin) {
                $sendToEmail = $user->personal_gmail;

                // If admin has no personal_gmail configured, we cannot proceed
                if (empty($sendToEmail)) {
                    Log::warning('Admin password reset attempted but no personal_gmail configured', [
                        'user_id' => $user->id,
                        'email' => $user->email,
                        'ip' => $ipAddress,
                    ]);

                    // Still return generic success for security (no email enumeration)
                    return response()->json([
                        'success' => true,
                        'message' => 'If an account with that email exists, a password reset code has been sent.',
                        'expires_in' => self::OTP_EXPIRY_MINUTES,
                    ]);
                }
            } else {
                $sendToEmail = $user->email;
            }

            // Delete any existing tokens for this email
            DB::table('password_reset_tokens')->where('email', $user->email)->delete();

            // Store the new token and OTP (always store with work email as key)
            DB::table('password_reset_tokens')->insert([
                'email' => $user->email,
                'token' => Hash::make($token),
                'otp' => Hash::make($otp),
                'expires_at' => $expiresAt,
                'attempts' => 0,
                'created_at' => Carbon::now(),
            ]);

            // Send OTP email to the appropriate address
            try {
                Mail::to($sendToEmail)->send(new PasswordResetOTPMail($otp, $user->fullname ?? $user->name ?? 'User'));

                Log::info('Password reset OTP sent', [
                    'user_id' => $user->id,
                    'work_email' => $user->email,
                    'sent_to' => $isAdmin ? 'personal_gmail' : 'work_email',
                    'ip' => $ipAddress,
                ]);
            } catch (\Exception $e) {
                Log::error('Failed to send password reset email', [
                    'user_id' => $user->id,
                    'email' => $sendToEmail,
                    'error' => $e->getMessage(),
                ]);
            }
        } else {
            // Log attempt for non-existent email (security monitoring)
            Log::info('Password reset attempted for non-existent email', [
                'email' => $email,
                'ip' => $ipAddress,
            ]);
        }

        // Build response message
        // For admins, indicate the code was sent to their personal email (masked)
        $responseMessage = 'If an account with that email exists, a password reset code has been sent.';
        $maskedEmail = null;

        if ($user && $sendToEmail) {
            $maskedEmail = $this->maskEmail($sendToEmail);
            if ($isAdmin) {
                $responseMessage = 'A verification code has been sent to your personal email.';
            }
        }

        // Always return success to prevent email enumeration attacks
        return response()->json([
            'success' => true,
            'message' => $responseMessage,
            'masked_email' => $maskedEmail,
            'expires_in' => self::OTP_EXPIRY_MINUTES,
        ]);
    }

    /**
     * Masks an email address for display (e.g., "jo***@gmail.com").
     *
     * @param string $email
     * @return string
     */
    private function maskEmail(string $email): string
    {
        $parts = explode('@', $email);
        if (count($parts) !== 2) {
            return '***@***.***';
        }

        $local = $parts[0];
        $domain = $parts[1];

        // Mask local part
        if (strlen($local) > 3) {
            $maskedLocal = substr($local, 0, 2) . '***' . substr($local, -1);
        } elseif (strlen($local) > 1) {
            $maskedLocal = $local[0] . '***';
        } else {
            $maskedLocal = '***';
        }

        return $maskedLocal . '@' . $domain;
    }

    /**
     * Verify the OTP provided by the user.
     *
     * This endpoint:
     * 1. Validates the OTP format
     * 2. Checks if OTP exists and hasn't expired
     * 3. Verifies the OTP matches
     * 4. Tracks failed attempts for brute-force protection
     * 5. Returns a reset token on success
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function verifyOTP(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email|max:255',
            'otp' => 'required|string|size:6',
        ]);

        $email = strtolower(trim($request->email));
        $otp = $request->otp;
        $ipAddress = $request->ip();

        // Rate limiting for OTP verification attempts
        $rateLimitKey = 'otp_verify:' . $ipAddress;

        if (RateLimiter::tooManyAttempts($rateLimitKey, 10)) {
            return response()->json([
                'success' => false,
                'message' => 'Too many verification attempts. Please try again later.',
            ], 429);
        }

        RateLimiter::hit($rateLimitKey, 3600);

        // Find the password reset record
        $resetRecord = DB::table('password_reset_tokens')
            ->whereRaw('LOWER(email) = ?', [$email])
            ->first();

        if (!$resetRecord) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid or expired verification code.',
            ], 400);
        }

        // Check if OTP has expired
        if (Carbon::parse($resetRecord->expires_at)->isPast()) {
            DB::table('password_reset_tokens')->where('email', $resetRecord->email)->delete();

            return response()->json([
                'success' => false,
                'message' => 'Verification code has expired. Please request a new one.',
            ], 400);
        }

        // Check if maximum attempts exceeded
        if ($resetRecord->attempts >= self::MAX_ATTEMPTS) {
            DB::table('password_reset_tokens')->where('email', $resetRecord->email)->delete();

            Log::warning('Password reset OTP max attempts exceeded', [
                'email' => $resetRecord->email,
                'ip' => $ipAddress,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Maximum verification attempts exceeded. Please request a new code.',
            ], 400);
        }

        // Verify OTP
        if (!Hash::check($otp, $resetRecord->otp)) {
            // Increment attempt counter
            DB::table('password_reset_tokens')
                ->where('email', $resetRecord->email)
                ->increment('attempts');

            $remainingAttempts = self::MAX_ATTEMPTS - $resetRecord->attempts - 1;

            Log::info('Invalid OTP attempt', [
                'email' => $resetRecord->email,
                'ip' => $ipAddress,
                'attempts' => $resetRecord->attempts + 1,
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Invalid verification code. ' . max(0, $remainingAttempts) . ' attempts remaining.',
            ], 400);
        }

        // OTP is valid - generate a reset token for the next step
        $resetToken = Str::random(64);

        // Update the record with the new token and mark OTP as verified
        DB::table('password_reset_tokens')
            ->where('email', $resetRecord->email)
            ->update([
                'token' => Hash::make($resetToken),
                'otp' => null, // Clear OTP after verification
                'expires_at' => Carbon::now()->addMinutes(10), // 10 minutes to reset password
            ]);

        Log::info('Password reset OTP verified', [
            'email' => $resetRecord->email,
            'ip' => $ipAddress,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Verification successful. You can now reset your password.',
            'reset_token' => $resetToken,
        ]);
    }

    /**
     * Reset the user's password.
     *
     * Password Requirements:
     * - At least 8 characters long
     * - At least one uppercase letter
     * - At least one special character
     * - At least two numbers
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function resetPassword(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email|max:255',
            'token' => 'required|string|min:64',
            'password' => [
                'required',
                'string',
                'min:8',
                'confirmed', // Requires password_confirmation field
                function ($attribute, $value, $fail) {
                    // At least one uppercase letter
                    if (!preg_match('/[A-Z]/', $value)) {
                        $fail('Password must contain at least one uppercase letter.');
                    }
                    // At least one special character
                    if (!preg_match('/[!@#$%^&*(),.?":{}|<>_\-=+\[\]\\\\\/`~;\']/u', $value)) {
                        $fail('Password must contain at least one special character.');
                    }
                    // At least two numbers
                    $numberCount = preg_match_all('/[0-9]/', $value);
                    if ($numberCount < 2) {
                        $fail('Password must contain at least two numbers.');
                    }
                },
            ],
        ]);

        $email = strtolower(trim($request->email));
        $token = $request->token;
        $ipAddress = $request->ip();

        // Find the password reset record
        $resetRecord = DB::table('password_reset_tokens')
            ->whereRaw('LOWER(email) = ?', [$email])
            ->first();

        if (!$resetRecord) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid or expired reset token.',
            ], 400);
        }

        // Check if token has expired
        if (Carbon::parse($resetRecord->expires_at)->isPast()) {
            DB::table('password_reset_tokens')->where('email', $resetRecord->email)->delete();

            return response()->json([
                'success' => false,
                'message' => 'Reset token has expired. Please start the process again.',
            ], 400);
        }

        // Verify token
        if (!Hash::check($token, $resetRecord->token)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid reset token.',
            ], 400);
        }

        // Find the user
        $user = User::whereRaw('LOWER(email) = ?', [$email])->first();

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found.',
            ], 404);
        }

        // Update the password using bcrypt (Laravel's default)
        $user->password = Hash::make($request->password);
        $user->save();

        // Delete the reset token
        DB::table('password_reset_tokens')->where('email', $resetRecord->email)->delete();

        // Determine confirmation email address (admins use personal_gmail)
        $isAdmin = strtolower($user->role ?? '') === 'admin';
        $confirmationEmail = $isAdmin && !empty($user->personal_gmail)
            ? $user->personal_gmail
            : $user->email;

        // Send confirmation email
        try {
            Mail::to($confirmationEmail)->send(new PasswordResetSuccessMail($user->fullname ?? $user->name ?? 'User'));
        } catch (\Exception $e) {
            Log::error('Failed to send password reset confirmation email', [
                'email' => $confirmationEmail,
                'error' => $e->getMessage(),
            ]);
        }

        // Log the password reset
        Log::info('Password reset successful', [
            'user_id' => $user->id,
            'email' => $user->email,
            'ip' => $ipAddress,
        ]);

        // Create audit log entry if the model exists
        if (class_exists(\App\Models\AuditLog::class)) {
            try {
                \App\Models\AuditLog::create([
                    'user_id' => $user->id,
                    'action' => 'password_reset',
                    'ip_address' => $ipAddress,
                    'session_key' => null,
                ]);
            } catch (\Exception $e) {
                // Ignore audit log errors
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Password has been reset successfully. You can now login with your new password.',
        ]);
    }

    /**
     * Resend OTP to the user's email.
     *
     * This endpoint allows users to request a new OTP if the previous one has expired
     * or if they didn't receive it.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function resendOTP(Request $request): JsonResponse
    {
        // Reuse the sendResetOTP method which handles all the logic
        return $this->sendResetOTP($request);
    }
}
