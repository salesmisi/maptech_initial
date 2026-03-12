<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class ModuleUnlocked implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $userId;
    public string $moduleId;
    public string $courseId;

    public function __construct(int $userId, string $courseId, string $moduleId)
    {
        $this->userId = $userId;
        $this->courseId = $courseId;
        $this->moduleId = $moduleId;
    }

    public function broadcastWith(): array
    {
        return [
            'user_id' => $this->userId,
            'course_id' => $this->courseId,
            'module_id' => $this->moduleId,
            'message' => 'A specific module has been unlocked for you by the instructor.',
        ];
    }

    public function broadcastOn()
    {
        return new PrivateChannel('user.' . $this->userId);
    }
}
