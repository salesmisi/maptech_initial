<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class ForceJsonAccept
{
    /**
     * Handle an incoming request.
     * If the `Accept` header is missing, set it to `application/json` so
     * API routes will return JSON responses instead of redirects.
     *
     * @return mixed
     */
    public function handle(Request $request, Closure $next)
    {
        if (! $request->headers->has('Accept')) {
            $request->headers->set('Accept', 'application/json');
        }

        return $next($request);
    }
}
