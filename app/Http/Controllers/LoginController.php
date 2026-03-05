<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use App\Models\User;

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

        return response()->json([
            'id' => $user->id,
            'name' => $user->fullName,
            'email' => $user->email,
            'role' => $user->role,
            'department' => $user->department,
            'status' => $user->status,
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

        return response()->json([
            'token' => $token,
            'token_type' => 'Bearer',
            'user' => [
                'id' => $user->id,
                'name' => $user->fullName,
                'email' => $user->email,
                'role' => $user->role,
                'department' => $user->department,
                'status' => $user->status,
            ]
        ]);
    }

    /**
     * Logout user (revoke token or destroy session).
     */
    public function logout(Request $request)
    {
        // For API token logout
        if ($request->user() && $request->user()->currentAccessToken()) {
            $request->user()->currentAccessToken()->delete();
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
            'name' => $user->fullName,
            'email' => $user->email,
            'role' => $user->role,
            'department' => $user->department,
            'status' => $user->status,
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
