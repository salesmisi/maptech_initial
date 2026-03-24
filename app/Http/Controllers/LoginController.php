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

class LoginController extends Controller
{
    /**
     * Handle session-based login (for SPA with cookies).
     */
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        // Find user by email
        $user = User::where('email', $credentials['email'])->first();

        // Check if user exists
        if (!$user) {
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        // Check if account is active BEFORE authentication
        if (!$user->isActive()) {
            return response()->json([
                'message' => 'Your account is inactive. Please contact administrator.'
            ], 401);
        }

        // Attempt authentication
        if (!Auth::attempt($credentials)) {
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        $request->session()->regenerate();

        // Record a single consistent UTC timestamp for audit + time log
        $ts = Carbon::now();
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
                    'created_at' => $ts,
                ]);
                // Broadcast the audit log so admins receive realtime updates
                event(new AuditLogCreated($log));
            } catch (\Exception $e) {
                Log::warning('Failed to create AuditLog on login', ['error' => $e->getMessage()]);
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
            'email' => 'required|email',
            'password' => 'required',
        ]);

        // Find user by email
        $user = User::where('email', $credentials['email'])->first();

        // Check credentials
        if (!$user || !Hash::check($credentials['password'], $user->password)) {
            return response()->json(['message' => 'Invalid credentials'], 401);
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
        $token = $user->createToken('auth-token', $abilities)->plainTextToken;

        // Record single timestamp for API login audit + time log
            $ts = Carbon::now();
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
                    'created_at' => $ts,
                ]);
                // Broadcast the audit log so admins receive realtime updates
                event(new AuditLogCreated($log));
            } catch (\Exception $e) {
                Log::warning('Failed to create AuditLog on apiLogin', ['error' => $e->getMessage()]);
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
            $ts = Carbon::now();
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
                        'created_at' => $ts,
                    ]);
                    event(new AuditLogCreated($log));
                } catch (\Exception $e) {
                    Log::warning('Failed to create AuditLog on logout', ['error' => $e->getMessage()]);
                }
            }

            // If user is an employee or admin, close ALL open time logs (punched-in without time_out)
            if ($shouldTrack) {
                Log::info('LOGOUT: Closing open TimeLogs', ['user_id' => $user->id]);
                $openLogs = TimeLog::where('user_id', $user->id)->whereNull('time_out')->get();
                foreach ($openLogs as $open) {
                    Log::info('LOGOUT: Closing TimeLog', ['log_id' => $open->id, 'user_id' => $user->id]);
                    $open->time_out = $ts;
                    $open->save();
                    event(new TimeLogUpdated($open->fresh()));
                }
            }
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
