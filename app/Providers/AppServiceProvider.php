<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Carbon;


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

        // Listen for AuditLogCreated events and ensure TimeLog rows are
        // created/closed accordingly so all audit-driven paths (routes,
        // controllers, etc.) update time_logs consistently.
        Event::listen(\App\Events\AuditLogCreated::class, function ($event) {
            try {
                $audit = $event->auditLog ?? null;
                if (! $audit) {
                    return;
                }

                $action = $audit->action ?? null;
                $userId = $audit->user_id ?? null;
                if (! $userId || ! in_array($action, ['login', 'logout'])) {
                    return;
                }

                // Prefer the audit's created_at if present, otherwise use now UTC
                $ts = null;
                if (! empty($audit->created_at)) {
                    $ts = Carbon::parse($audit->created_at)->utc();
                } else {
                    $ts = Carbon::now();
                }

                // On login: create a TimeLog only if there is no open one
                if ($action === 'login') {
                    $open = \App\Models\TimeLog::where('user_id', $userId)->whereNull('time_out')->latest('time_in')->first();
                    if (! $open) {
                        $tl = \App\Models\TimeLog::create([
                            'user_id' => $userId,
                            'time_in' => $ts,
                        ]);
                        event(new \App\Events\TimeLogUpdated($tl->fresh()));
                    }
                    return;
                }

                // On logout: close any open TimeLog rows
                if ($action === 'logout') {
                    $openLogs = \App\Models\TimeLog::where('user_id', $userId)->whereNull('time_out')->get();
                    foreach ($openLogs as $open) {
                        $open->time_out = $ts;
                        $open->save();
                        event(new \App\Events\TimeLogUpdated($open->fresh()));
                    }
                }
            } catch (\Exception $e) {
                Log::warning('AuditLogCreated listener failed: ' . $e->getMessage());
            }
        });
    }
}
