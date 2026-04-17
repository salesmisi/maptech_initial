<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Carbon;
use App\Models\User;
use App\Models\AuditLog;
use App\Models\TimeLog;
use App\Events\AuditLogCreated;
use App\Events\TimeLogUpdated;
use App\Rules\MaptechEmail;

class LoginController extends Controller
{
    /**
     * Handle session-based login (for SPA with cookies).
     */
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => ['required', 'email', new MaptechEmail],
            'password' => 'required',
        ]);

        // Find user by email
        $user = User::where('email', $credentials['email'])->first();

        // Check if user exists
        if (!$user) {
            return response()->json(['message' => 'Email address not found'], 401);
        }

        // Check if account is active BEFORE authentication
        if (!$user->isActive()) {
            return response()->json([
                'message' => 'Your account is inactive. Please contact administrator.'
            ], 401);
        }

        // Attempt authentication
        if (!Auth::attempt($credentials)) {
            return response()->json(['message' => 'Incorrect password'], 401);
        }

        $request->session()->regenerate();

        $sessionKey = 'web:' . $request->session()->getId();

        // Record a single explicit UTC timestamp for audit + time log.
        // Using UTC avoids DB/session timezone ambiguity across environments.
        $ts = Carbon::now('UTC')->toIso8601String();
        // Debug: Log user role
        Log::info('LOGIN: User role check', ['id' => $user->id, 'role' => $user->role, 'isEmployee' => $user->isEmployee(), 'isInstructor' => $user->isInstructor(), 'isAdmin' => $user->isAdmin()]);
        // Record audit log for Employees and Admins
        $log = null;
        $shouldTrack = $user->isEmployee() || $user->isInstructor() || $user->isAdmin();
        if ($shouldTrack) {
            Log::info('LOGIN: Creating AuditLog', ['user_id' => $user->id, 'action' => 'login']);
            try {
                $log = AuditLog::create([
                    'user_id' => $user->id,
                    'action' => 'login',
                    'ip_address' => $request->ip(),
                    'session_key' => $sessionKey,
                    'created_at' => $ts,
                ]);
                if ($log) {
                    $request->session()->put('current_login_audit_id', $log->id);
                }
                // Broadcast the audit log so admins receive realtime updates
                event(new AuditLogCreated($log));
            } catch (\Exception $e) {
                Log::error('Failed to create AuditLog on login', [
                    'error' => $e->getMessage(),
                    'user_id' => $user->id,
                    'file' => $e->getFile(),
                    'line' => $e->getLine(),
                ]);
            }
        }

        // For login, always start a fresh TimeLog tied to this login time.
        // Close any previously open logs so that each login/logout pair is a distinct session.
        $timeLog = null;
        if ($shouldTrack) {
            $openLogs = TimeLog::where('user_id', $user->id)->whereNull('time_out')->get();
            foreach ($openLogs as $open) {
                Log::info('LOGIN: Closing stale open TimeLog before creating new one', ['log_id' => $open->id, 'user_id' => $user->id]);
                $open->time_out = $ts;
                $open->save();
                event(new TimeLogUpdated($open->fresh()));
            }

            Log::info('LOGIN: Creating new TimeLog for this login', ['user_id' => $user->id, 'time_in' => $ts]);
            $timeLog = TimeLog::create([
                'user_id' => $user->id,
                'session_key' => $sessionKey,
                'login_audit_log_id' => $log?->id,
                'time_in' => $ts,
            ]);
            event(new TimeLogUpdated($timeLog->fresh()));
        }

        return response()->json([
            'id' => $user->id,
            'name' => $user->fullname,
            'fullName' => $user->fullname,
            'fullname' => $user->fullname,
            'email' => $user->email,
            'role' => $user->role,
            'department' => $user->department,
            'status' => $user->status,
            'profile_picture' => $user->profile_picture ? asset('storage/' . $user->profile_picture) : null,
            'signature_path' => $user->signature_path ? asset('storage/' . $user->signature_path) : null,
            'time_log' => $timeLog,
        ]);
    }

    /**
     * Handle API token-based login (JWT-like with Sanctum).
     * Returns a bearer token for API authentication.
     */
    public function apiLogin(Request $request)
    {
        $credentials = $request->validate([
            'email' => ['required', 'email', new MaptechEmail],
            'password' => 'required',
        ]);

        // Find user by email
        $user = User::where('email', $credentials['email'])->first();

        // Check if user exists
        if (!$user) {
            return response()->json(['message' => 'Email address not found'], 401);
        }

        // Check password
        if (!Hash::check($credentials['password'], $user->password)) {
            return response()->json(['message' => 'Incorrect password'], 401);
        }

        // Check if account is active
        if (!$user->isActive()) {
            return response()->json([
                'message' => 'Your account is inactive. Please contact administrator.'
            ], 401);
        }

        // Revoke previous tokens
        $user->tokens()->delete();

        // Create new token with abilities based on role
        $abilities = $this->getTokenAbilities($user);
        $newToken = $user->createToken('auth-token', $abilities);
        $token = $newToken->plainTextToken;
        $sessionKey = 'token:' . $newToken->accessToken->id;

        // Record single explicit UTC timestamp for API login audit + time log.
        $ts = Carbon::now('UTC')->toIso8601String();
        // Debug: Log user role
        Log::info('API LOGIN: User role check', ['id' => $user->id, 'role' => $user->role, 'isEmployee' => $user->isEmployee(), 'isInstructor' => $user->isInstructor(), 'isAdmin' => $user->isAdmin()]);
        // Record audit log for Employees and Admins
        $log = null;
        $shouldTrack = $user->isEmployee() || $user->isInstructor() || $user->isAdmin();
        if ($shouldTrack) {
            Log::info('API LOGIN: Creating AuditLog', ['user_id' => $user->id, 'action' => 'login']);
            try {
                $log = AuditLog::create([
                    'user_id' => $user->id,
                    'action' => 'login',
                    'ip_address' => $request->ip(),
                    'session_key' => $sessionKey,
                    'created_at' => $ts,
                ]);
                // Broadcast the audit log so admins receive realtime updates
                event(new AuditLogCreated($log));
            } catch (\Exception $e) {
                Log::error('Failed to create AuditLog on apiLogin', [
                    'error' => $e->getMessage(),
                    'user_id' => $user->id,
                    'file' => $e->getFile(),
                    'line' => $e->getLine(),
                ]);
            }
        }

        // For API login, mirror session login behavior: close any open logs and create a new one.
        $timeLog = null;
        if ($shouldTrack) {
            $openLogs = TimeLog::where('user_id', $user->id)->whereNull('time_out')->get();
            foreach ($openLogs as $open) {
                Log::info('API LOGIN: Closing stale open TimeLog before creating new one', ['log_id' => $open->id, 'user_id' => $user->id]);
                $open->time_out = $ts;
                $open->save();
                event(new TimeLogUpdated($open->fresh()));
            }

            Log::info('API LOGIN: Creating new TimeLog for this login', ['user_id' => $user->id, 'time_in' => $ts]);
            $timeLog = TimeLog::create([
                'user_id' => $user->id,
                'session_key' => $sessionKey,
                'login_audit_log_id' => $log?->id,
                'time_in' => $ts,
            ]);
            event(new TimeLogUpdated($timeLog->fresh()));
        }

        return response()->json([
            'token' => $token,
            'token_type' => 'Bearer',
            'user' => [
                'id' => $user->id,
                'name' => $user->fullname,
                'fullName' => $user->fullname,
                'fullname' => $user->fullname,
                'email' => $user->email,
                'role' => $user->role,
                'department' => $user->department,
                'status' => $user->status,
                'profile_picture' => $user->profile_picture ? asset('storage/' . $user->profile_picture) : null,
                'signature_path' => $user->signature_path ? asset('storage/' . $user->signature_path) : null,
            ],
            'time_log' => $timeLog,
        ]);
    }

    /**
     * Logout user (revoke token or destroy session).
     */
    public function logout(Request $request)
    {
        $user = $request->user();

        if ($user) {
            $ts = Carbon::now('UTC')->toIso8601String();
            $sessionKey = $user->currentAccessToken()
                ? 'token:' . $user->currentAccessToken()->id
                : 'web:' . $request->session()->getId();
            $savedLoginAuditId = (int) $request->session()->get('current_login_audit_id', 0);
            // Debug: Log user role
            Log::info('LOGOUT: User role check', ['id' => $user->id, 'role' => $user->role, 'isEmployee' => $user->isEmployee(), 'isInstructor' => $user->isInstructor(), 'isAdmin' => $user->isAdmin()]);
            // Record logout audit for Employees and Admins
            $log = null;
            $shouldTrack = $user->isEmployee() || $user->isInstructor() || $user->isAdmin();
            if ($shouldTrack) {
                Log::info('LOGOUT: Creating AuditLog', ['user_id' => $user->id, 'action' => 'logout']);
                try {
                    $log = AuditLog::create([
                        'user_id' => $user->id,
                        'action' => 'logout',
                        'ip_address' => $request->ip(),
                        'session_key' => $sessionKey,
                        'created_at' => $ts,
                    ]);
                    event(new AuditLogCreated($log));
                } catch (\Exception $e) {
                    Log::error('Failed to create AuditLog on logout', [
                        'error' => $e->getMessage(),
                        'user_id' => $user->id,
                        'file' => $e->getFile(),
                        'line' => $e->getLine(),
                    ]);
                }
            }

            // If user is an employee or admin, close ALL open time logs (punched-in without time_out)
            if ($shouldTrack) {
                Log::info('LOGOUT: Closing open TimeLogs', ['user_id' => $user->id]);
                Log::info('LOGOUT DEBUG: Matching context', [
                    'user_id' => $user->id,
                    'session_key' => $sessionKey,
                    'saved_login_audit_id' => $savedLoginAuditId,
                    'logout_audit_id' => $log?->id,
                ]);
                // Prefer exact linkage by saved login audit id for web session-auth flows.
                $openLogs = collect();
                if ($savedLoginAuditId > 0) {
                    $openLogs = TimeLog::where('user_id', $user->id)
                        ->where('login_audit_log_id', $savedLoginAuditId)
                        ->whereNull('time_out')
                        ->get();

                    Log::info('LOGOUT DEBUG: Match by login_audit_log_id', [
                        'count' => $openLogs->count(),
                        'time_log_ids' => $openLogs->pluck('id')->values()->all(),
                    ]);
                }

                // Fallback to session key when no saved login audit id is available.
                if ($openLogs->isEmpty()) {
                    $openLogs = TimeLog::where('user_id', $user->id)
                        ->where('session_key', $sessionKey)
                        ->whereNull('time_out')
                        ->get();

                    Log::info('LOGOUT DEBUG: Match by session_key', [
                        'count' => $openLogs->count(),
                        'time_log_ids' => $openLogs->pluck('id')->values()->all(),
                    ]);
                }

                // Fallback for legacy rows that don't have session_key yet.
                if ($openLogs->isEmpty()) {
                    $openLogs = TimeLog::where('user_id', $user->id)->whereNull('time_out')->get();

                    Log::info('LOGOUT DEBUG: Legacy fallback match', [
                        'count' => $openLogs->count(),
                        'time_log_ids' => $openLogs->pluck('id')->values()->all(),
                    ]);
                }

                foreach ($openLogs as $open) {
                    Log::info('LOGOUT: Closing TimeLog', ['log_id' => $open->id, 'user_id' => $user->id]);
                    $open->time_out = $ts;
                    if ($log) {
                        $open->logout_audit_log_id = $log->id;
                    }
                    $open->save();
                    Log::info('LOGOUT DEBUG: TimeLog updated', [
                        'time_log_id' => $open->id,
                        'user_id' => $user->id,
                        'time_out' => $open->time_out,
                        'logout_audit_log_id' => $open->logout_audit_log_id,
                    ]);
                    event(new TimeLogUpdated($open->fresh()));
                }
            }

            $request->session()->forget('current_login_audit_id');
        }

        // For API token logout
        if ($user && $user->currentAccessToken()) {
            $user->currentAccessToken()->delete();
        }

        // For session logout
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Logged out successfully']);
    }

    /**
     * Get authenticated user info.
     */
    public function user(Request $request)
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        return response()->json([
            'id' => $user->id,
            'name' => $user->fullname,
            'fullName' => $user->fullname,
            'fullname' => $user->fullname,
            'email' => $user->email,
            'role' => $user->role,
            'department' => $user->department,
            'status' => $user->status,
            'profile_picture' => $user->profile_picture ? asset('storage/' . $user->profile_picture) : null,
            'signature_path' => $user->signature_path ? asset('storage/' . $user->signature_path) : null,
        ]);
    }

    /**
     * Get token abilities based on user role.
     */
    private function getTokenAbilities(User $user): array
    {
        $role = strtolower($user->role);

        return match ($role) {
            'admin' => ['admin:*', 'read', 'write', 'delete'],
            'instructor' => ['instructor:*', 'read', 'write'],
            'employee' => ['employee:*', 'read'],
            default => ['read'],
        };
    }

}
