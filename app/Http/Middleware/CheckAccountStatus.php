<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckAccountStatus
{
    /**
     * Handle an incoming request.
     * Block inactive accounts from accessing protected routes.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'message' => 'Unauthenticated'
            ], 401);
        }

        // Accept case-insensitive status values (e.g. 'active' or 'Active')
        $status = $user->status ?? '';
        if (strtolower($status) !== 'active') {
            return response()->json([
                'message' => 'Your account is inactive. Please contact administrator.',
                'status' => $user->status,
            ], 403);
        }

        return $next($request);
    }
}
