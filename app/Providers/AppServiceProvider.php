<?php

namespace App\Providers;

use App\Models\CustomModule;
use App\Policies\CustomModulePolicy;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

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
        // Always generate HTTPS URLs in production.
        if (app()->environment('production')) {
            URL::forceScheme('https');
        }

        // Shared API auth throttles to reduce brute-force and OTP abuse.
        RateLimiter::for('api-login', function (Request $request) {
            $email = strtolower((string) $request->input('email', ''));

            return [
                Limit::perMinute(10)->by($request->ip().'|'.$email),
                Limit::perHour(120)->by($request->ip()),
            ];
        });

        RateLimiter::for('api-password', function (Request $request) {
            $email = strtolower((string) $request->input('email', ''));

            return [
                Limit::perMinute(6)->by($request->ip().'|'.$email),
                Limit::perHour(60)->by($request->ip()),
            ];
        });

        // Register policies
        Gate::policy(CustomModule::class, CustomModulePolicy::class);

        // If app is configured to use the Pusher broadcaster but the Pusher PHP
        // SDK is not installed, fallback to the `log` broadcaster to avoid
        // a fatal exception when creating the broadcaster.
        $envDriver = env('BROADCAST_DRIVER');
        $currentDefault = config('broadcasting.default') ?? $envDriver;

        if (strtolower((string) $currentDefault) === 'pusher' && ! class_exists(\Pusher\Pusher::class)) {
            // Set fallback to `log` so the app continues to work without Pusher.
            config(['broadcasting.default' => 'log']);
            Log::warning('Pusher PHP SDK not found; falling back to log broadcaster. Install pusher/pusher-php-server to enable Pusher.');
        }

        // Time log writes are handled directly in controllers to avoid duplicate
        // session rows from multiple writers mutating time_logs for the same event.
    }
}
