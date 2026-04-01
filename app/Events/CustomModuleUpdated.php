<?php

namespace App\Events;

use App\Models\CustomModule;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CustomModuleUpdated
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    /**
     * The custom module that was updated.
     */
    public CustomModule $customModule;

    /**
     * Whether the module should trigger a sync.
     */
    public bool $shouldSync;

    /**
     * Create a new event instance.
     */
    public function __construct(CustomModule $customModule, bool $shouldSync = true)
    {
        $this->customModule = $customModule;
        $this->shouldSync = $shouldSync;
    }
}
