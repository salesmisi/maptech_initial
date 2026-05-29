<?php

namespace App\Exceptions;

use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Http\Response;

class Handler extends ExceptionHandler
{
    /**
     * Convert an authentication exception into a response.
     *
     * For API routes we return JSON instead of redirecting to a login route.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\Response|\Illuminate\Http\JsonResponse|\Illuminate\Http\RedirectResponse
     */
    protected function unauthenticated($request, AuthenticationException $exception)
    {
        if ($request->expectsJson() || $request->is('api/*')) {
            return response()->json([
                'message' => $exception->getMessage() ?: 'Unauthenticated.',
            ], 401);
        }

        return redirect()->guest($exception->redirectTo($request) ?? route('login'));
    }

    /**
     * Register the exception handling callbacks for the application.
     */
    public function register(): void
    {
        // Use the parent default registration (no-op here).
    }
}
