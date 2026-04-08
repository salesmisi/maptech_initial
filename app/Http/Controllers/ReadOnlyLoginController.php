<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;
use App\Models\User;

class ReadOnlyLoginController extends Controller
{
    /**
     * Handle session-based read-only login.
     * Does not write to the database; only reads user records.
     */
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        $user = User::where('email', $credentials['email'])->first();

        if (! $user) {
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        // If there's an isActive method keep the check (read-only)
        if (method_exists($user, 'isActive') && ! $user->isActive()) {
            return response()->json(['message' => 'Your account is inactive. Please contact administrator.'], 401);
        }

        if (! Hash::check($credentials['password'], $user->password)) {
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        // Authenticate the user in the session without modifying the database.
        Auth::login($user);
        $request->session()->regenerate();

        // For SPA convenience, also issue a short-lived personal access token
        // so the frontend can use bearer auth as a fallback when cookies fail.
        $token = $user->createToken('session-token')->plainTextToken;

        return response()->json([
            'id' => $user->id,
            'name' => $user->fullname,
            'email' => $user->email,
            'role' => $user->role,
            'department' => $user->department ?? null,
            'status' => $user->status ?? null,
            'profile_picture' => $user->profile_picture ? asset('storage/' . $user->profile_picture) : null,
            'token' => $token,
        ]);
    }

    /**
     * Logout by clearing the session (read-only behavior).
     */
    public function logout(Request $request)
    {
        // Log out the session user (no DB writes).
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Logged out successfully']);
    }

    /**
     * Return the authenticated user from session (read-only).
     */
    public function user(Request $request)
    {
        $user = $request->user() ?? Auth::user();
        if (! $user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        return response()->json([
            'id' => $user->id,
            'name' => $user->fullname,
            'email' => $user->email,
            'role' => $user->role,
            'department' => $user->department ?? null,
            'status' => $user->status ?? null,
            'profile_picture' => $user->profile_picture ? asset('storage/' . $user->profile_picture) : null,
        ]);
    }
}
