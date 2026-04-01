<?php

namespace App\Events;

use App\Models\Course;
use App\Models\Module;
use App\Models\CustomModule;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Event fired when content is synced from Custom Module to Course.
 * Broadcasts to all users who need to know about the new content.
 */
class ContentSynced implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public Course $course;
    public Module $module;
    public CustomModule $customModule;
    public string $action; // 'created', 'updated', 'deleted'

    public function __construct(Course $course, Module $module, CustomModule $customModule, string $action = 'created')
    {
        $this->course = $course;
        $this->module = $module;
        $this->customModule = $customModule;
        $this->action = $action;
    }

    /**
     * Get the channels the event should broadcast on.
     * Broadcasts to the course channel so all enrolled users receive updates.
     */
    public function broadcastOn(): array
    {
        return [
            new PrivateChannel('course.' . $this->course->id),
        ];
    }

    /**
     * Get the data to broadcast.
     */
    public function broadcastWith(): array
    {
        return [
            'action' => $this->action,
            'course_id' => $this->course->id,
            'course_title' => $this->course->title,
            'module_id' => $this->module->id,
            'module_title' => $this->module->title,
            'custom_module_id' => $this->customModule->id,
            'lessons_count' => $this->module->lessons()->count(),
            'synced_at' => now()->toISOString(),
        ];
    }

    /**
     * The event's broadcast name.
     */
    public function broadcastAs(): string
    {
        return 'content.synced';
    }
}
