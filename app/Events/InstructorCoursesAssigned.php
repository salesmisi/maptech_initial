<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class InstructorCoursesAssigned implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public int $instructorId;
    public array $courseIds;

    /**
     * Create a new event instance.
     */
    public function __construct(int $instructorId, array $courseIds)
    {
        $this->instructorId = $instructorId;
        $this->courseIds = $courseIds;
    }

    /**
     * Get the channels the event should broadcast on.
     */
    public function broadcastOn()
    {
        return new PrivateChannel('instructor.' . $this->instructorId);
    }

    /**
     * Data to broadcast with the event.
     */
    public function broadcastWith()
    {
        return [
            'instructor_id' => $this->instructorId,
            'course_ids' => $this->courseIds,
        ];
    }
}
