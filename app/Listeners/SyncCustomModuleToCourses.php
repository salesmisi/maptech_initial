<?php

namespace App\Listeners;

use App\Events\CustomModuleUpdated;
use App\Services\ContentSyncService;
use Illuminate\Support\Facades\Log;

class SyncCustomModuleToCourses
{
    /**
     * The sync service.
     */
    protected ContentSyncService $syncService;

    /**
     * Create the event listener.
     */
    public function __construct(ContentSyncService $syncService)
    {
        $this->syncService = $syncService;
    }

    /**
     * Handle the event.
     */
    public function handle(CustomModuleUpdated $event): void
    {
        if (!$event->shouldSync) {
            return;
        }

        try {
            $this->syncService->autoSyncToLinkedCourses($event->customModule);

            Log::info('Custom module synced to all courses with notifications', [
                'custom_module_id' => $event->customModule->id,
                'title' => $event->customModule->title,
            ]);
        } catch (\Throwable $e) {
            Log::error('Failed to sync custom module to courses', [
                'custom_module_id' => $event->customModule->id,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
