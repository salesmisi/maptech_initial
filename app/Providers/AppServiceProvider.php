<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Log;


class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // If app is configured to use the Pusher broadcaster but the Pusher PHP
        // SDK is not installed, fallback to the `log` broadcaster to avoid
        // a fatal exception when creating the broadcaster.
        $envDriver = env('BROADCAST_DRIVER');
        $currentDefault = config('broadcasting.default') ?? $envDriver;

        if (strtolower((string) $currentDefault) === 'pusher' && !class_exists(\Pusher\Pusher::class)) {
            // Set fallback to `log` so the app continues to work without Pusher.
            config(['broadcasting.default' => 'log']);
            Log::warning('Pusher PHP SDK not found; falling back to log broadcaster. Install pusher/pusher-php-server to enable Pusher.');
        }

        // Time log writes are handled directly in controllers to avoid duplicate
        // session rows from multiple writers mutating time_logs for the same event.
    }
}
