<?php

namespace App\Http\Middleware;

class TrustProxies extends \Illuminate\Http\Middleware\TrustProxies
{
    /**
     * Trust proxy chain from load balancers / reverse proxies.
     * Configure explicitly via TRUSTED_PROXIES when needed.
     *
     * @var array<int, string>|string|null
     */
    protected $proxies;

    /**
     * Use standard forwarded headers so HTTPS and client IP resolve correctly.
     */
    protected $headers =
        \Illuminate\Http\Request::HEADER_X_FORWARDED_FOR |
        \Illuminate\Http\Request::HEADER_X_FORWARDED_HOST |
        \Illuminate\Http\Request::HEADER_X_FORWARDED_PORT |
        \Illuminate\Http\Request::HEADER_X_FORWARDED_PROTO |
        \Illuminate\Http\Request::HEADER_X_FORWARDED_AWS_ELB;

    public function __construct()
    {
        $this->proxies = env('TRUSTED_PROXIES', '*');
    }
}
