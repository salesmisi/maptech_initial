<?php

namespace App\Events;

use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\Channel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class AuditLogCreated implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public $auditLog;

    public function __construct($auditLog)
    {
        $this->auditLog = $auditLog;
    }

    public function broadcastOn()
    {
        // Broadcast on a private channel scoped to the user
        return new PrivateChannel('user.' . $this->auditLog->user_id);
    }

    public function broadcastWith()
    {
        return [
            'id' => $this->auditLog->id,
            'user_id' => $this->auditLog->user_id,
            'action' => $this->auditLog->action,
            'ip_address' => $this->auditLog->ip_address,
            'created_at' => optional($this->auditLog->created_at)->toIso8601String(),
        ];
    }
}
