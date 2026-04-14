<?php

namespace App\Http\Middleware;

class VerifyCsrfToken extends \Illuminate\Foundation\Http\Middleware\VerifyCsrfToken
{
    // CSRF verification wrapper
    protected $except = [
        // Add URIs that should be excluded from CSRF verification here
    ];
}
