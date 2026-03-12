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
    }
}
