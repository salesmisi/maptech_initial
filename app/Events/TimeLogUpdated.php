<?php

namespace App\Events;

use App\Models\TimeLog;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\ShouldBroadcast;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class TimeLogUpdated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public TimeLog $timeLog;

    public function __construct(TimeLog $timeLog)
    {
        $this->timeLog = $timeLog->loadMissing('user');
    }

    public function broadcastOn()
    {
        return new PrivateChannel('time-logs.' . $this->timeLog->user_id);
    }

    public function broadcastWith()
    {
        return [
            'time_log' => $this->timeLog->toArray(),
        ];
    }
}
