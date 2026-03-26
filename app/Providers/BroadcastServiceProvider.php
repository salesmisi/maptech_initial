<?php

namespace App\Providers;

use Illuminate\Broadcasting\BroadcastManager;
use Illuminate\Broadcasting\BroadcastServiceProvider as BaseProvider;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\ServiceProvider;

class BroadcastServiceProvider extends ServiceProvider
{
    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Authorize private channel: only allow user to listen to their own time-logs
        Broadcast::channel('time-logs.{userId}', function ($user, $userId) {
            return (int) $user->id === (int) $userId;
        });
        // Allow admins/instructors to listen to admin time-log channel for realtime updates
        Broadcast::channel('time-logs.admin', function ($user) {
            return in_array($user->role, ['Admin', 'Instructor']);
        });
        // Allow admins/instructors to listen to admin audit-log channel for realtime updates
        Broadcast::channel('audit-logs.admin', function ($user) {
            return in_array($user->role, ['Admin', 'Instructor']);
        });
        // Allow users to listen to their own notifications
        Broadcast::channel('notifications.{userId}', function ($user, $userId) {
            return (int) $user->id === (int) $userId;
        });
    }
}
