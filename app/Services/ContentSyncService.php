<?php

namespace App\Services;

use App\Events\ContentSynced;
use App\Models\Course;
use App\Models\CustomModule;
use App\Models\CustomLesson;
use App\Models\Enrollment;
use App\Models\Module;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * ContentSyncService handles the complete sync flow from Admin-created
 * Custom Modules to Courses, Instructors, and Employees.
 *
 * ============================================================================
 * SYSTEM FLOW: Admin → Instructor → Employee Content Sync
 * ============================================================================
 *
 * 1. ADMIN CREATES/UPDATES CONTENT
 *    ├── Admin creates CustomModule in Custom Field Builder
 *    ├── Admin adds CustomLessons (text, video, file, link, quiz)
 *    └── Admin sets status to "published"
 *
 * 2. COURSE MAPPING
 *    ├── Admin selects target courses via "Push to Course(s)" UI
 *    ├── System maps CustomModule → Course.modules
 *    └── System maps CustomLessons → Module.lessons
 *
 * 3. AUTOMATIC SYNC TRIGGER
 *    ├── When CustomModule.status = 'published' AND saved
 *    ├── CustomModuleUpdated event fires
 *    └── SyncCustomModuleToCourses listener triggers sync
 *
 * 4. CONTENT DISTRIBUTION
 *    ├── For each linked course:
 *    │   ├── Create/Update Module in course
 *    │   ├── Sync all lessons (create/update/delete)
 *    │   ├── Fire ContentSynced event (real-time broadcast)
 *    │   └── Create notifications for affected users
 *    └── Data is now consistent across all views
 *
 * 5. ACCESS CONTROL
 *    ├── ADMIN: Full CRUD on CustomModules, can sync to any course
 *    ├── INSTRUCTOR: Read-only access to synced modules in their courses
 *    └── EMPLOYEE: Access modules via course enrollment
 *
 * 6. REAL-TIME UPDATES
 *    ├── ContentSynced event broadcasts to course channel
 *    ├── NotificationCreated event broadcasts to user channels
 *    └── Frontend listeners update UI without page refresh
 *
 * ============================================================================
 */
class ContentSyncService
{
    protected CustomModuleSyncService $moduleSyncService;

    public function __construct(CustomModuleSyncService $moduleSyncService)
    {
        $this->moduleSyncService = $moduleSyncService;
    }

    /**
     * Sync a custom module to multiple courses with full notification flow.
     *
     * @param CustomModule $customModule The custom module to sync
     * @param array $courseIds Array of course IDs to sync to
     * @param User|null $syncedBy The admin user performing the sync
     * @return array Results with success/failure counts
     */
    public function syncToMultipleCourses(CustomModule $customModule, array $courseIds, ?User $syncedBy = null): array
    {
        $results = [
            'success_count' => 0,
            'failed_count' => 0,
            'synced_courses' => [],
            'errors' => [],
        ];

        foreach ($courseIds as $courseId) {
            try {
                $course = Course::find($courseId);
                if (!$course) {
                    $results['errors'][] = "Course {$courseId} not found";
                    $results['failed_count']++;
                    continue;
                }

                $module = $this->syncToCourseWithNotifications($customModule, $course, $syncedBy);

                $results['success_count']++;
                $results['synced_courses'][] = [
                    'course_id' => $course->id,
                    'course_title' => $course->title,
                    'module_id' => $module->id,
                ];
            } catch (\Exception $e) {
                Log::error('Content sync failed', [
                    'custom_module_id' => $customModule->id,
                    'course_id' => $courseId,
                    'error' => $e->getMessage(),
                ]);
                $results['errors'][] = "Failed to sync to course {$courseId}: " . $e->getMessage();
                $results['failed_count']++;
            }
        }

        return $results;
    }

    /**
     * Sync a custom module to a single course with notifications.
     */
    public function syncToCourseWithNotifications(CustomModule $customModule, Course $course, ?User $syncedBy = null): Module
    {
        // Check if this is a new sync or update
        $isNewSync = !$course->modules()->where('custom_module_id', $customModule->id)->exists();

        // Perform the sync
        $module = $this->moduleSyncService->syncToCourse($customModule, $course);

        // Broadcast the sync event for real-time updates
        event(new ContentSynced($course, $module, $customModule, $isNewSync ? 'created' : 'updated'));

        // Send notifications to affected users
        $this->notifyAffectedUsers($customModule, $course, $module, $isNewSync);

        Log::info('Content synced with notifications', [
            'custom_module_id' => $customModule->id,
            'course_id' => $course->id,
            'module_id' => $module->id,
            'is_new' => $isNewSync,
            'synced_by' => $syncedBy?->id,
        ]);

        return $module;
    }

    /**
     * Auto-sync published custom module to all linked courses.
     * Called by event listener when CustomModule is updated.
     */
    public function autoSyncToLinkedCourses(CustomModule $customModule): void
    {
        if ($customModule->status !== 'published') {
            return;
        }

        // Get all courses that have this module linked
        $linkedModules = Module::where('custom_module_id', $customModule->id)
            ->with('course')
            ->get();

        foreach ($linkedModules as $module) {
            if (!$module->course) continue;

            try {
                // Sync the content
                $this->moduleSyncService->syncToAllCourses($customModule);

                // Broadcast update event
                event(new ContentSynced($module->course, $module->fresh(), $customModule, 'updated'));

                // Notify users of the update
                $this->notifyAffectedUsers($customModule, $module->course, $module, false);
            } catch (\Exception $e) {
                Log::error('Auto-sync failed', [
                    'custom_module_id' => $customModule->id,
                    'course_id' => $module->course_id,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    /**
     * Remove a custom module from a course.
     */
    public function removeFromCourse(CustomModule $customModule, Course $course): void
    {
        DB::transaction(function () use ($customModule, $course) {
            $module = $course->modules()->where('custom_module_id', $customModule->id)->first();

            if (!$module) {
                return;
            }

            // Delete all lessons first
            $module->lessons()->delete();

            // Delete the module
            $module->delete();

            // Notify affected users about removal
            $this->notifyUsersOfRemoval($customModule, $course);

            Log::info('Content removed from course', [
                'custom_module_id' => $customModule->id,
                'course_id' => $course->id,
            ]);
        });
    }

    /**
     * Notify all affected users (Instructor + Enrolled Employees) about new/updated content.
     */
    protected function notifyAffectedUsers(CustomModule $customModule, Course $course, Module $module, bool $isNew): void
    {
        $notificationType = $isNew ? 'new_content' : 'content_updated';
        $title = $isNew ? 'New Learning Content Available' : 'Learning Content Updated';
        $message = $isNew
            ? "A new module \"{$customModule->title}\" has been added to course \"{$course->title}\"."
            : "The module \"{$customModule->title}\" in course \"{$course->title}\" has been updated.";

        // 1. Notify the course instructor
        if ($course->instructor_id) {
            $this->createNotification(
                $course->instructor_id,
                $course->id,
                $module->id,
                $notificationType,
                $title,
                $message,
                [
                    'custom_module_id' => $customModule->id,
                    'action' => $isNew ? 'created' : 'updated',
                ]
            );
        }

        // 2. Notify all enrolled employees
        $enrolledUserIds = Enrollment::where('course_id', $course->id)
            ->where('status', '!=', 'Dropped')
            ->pluck('user_id')
            ->toArray();

        foreach ($enrolledUserIds as $userId) {
            $this->createNotification(
                $userId,
                $course->id,
                $module->id,
                $notificationType,
                $title,
                $message,
                [
                    'custom_module_id' => $customModule->id,
                    'action' => $isNew ? 'created' : 'updated',
                ]
            );
        }

        Log::info('Notifications sent for content sync', [
            'course_id' => $course->id,
            'instructor_notified' => (bool) $course->instructor_id,
            'employees_notified' => count($enrolledUserIds),
        ]);
    }

    /**
     * Notify users when content is removed from a course.
     */
    protected function notifyUsersOfRemoval(CustomModule $customModule, Course $course): void
    {
        $title = 'Learning Content Removed';
        $message = "The module \"{$customModule->title}\" has been removed from course \"{$course->title}\".";

        // Notify instructor
        if ($course->instructor_id) {
            $this->createNotification(
                $course->instructor_id,
                $course->id,
                null,
                'content_removed',
                $title,
                $message,
                ['custom_module_id' => $customModule->id]
            );
        }

        // Notify enrolled employees
        $enrolledUserIds = Enrollment::where('course_id', $course->id)
            ->where('status', '!=', 'Dropped')
            ->pluck('user_id');

        foreach ($enrolledUserIds as $userId) {
            $this->createNotification(
                $userId,
                $course->id,
                null,
                'content_removed',
                $title,
                $message,
                ['custom_module_id' => $customModule->id]
            );
        }
    }

    /**
     * Create a notification record (auto-broadcasts via model event).
     */
    protected function createNotification(
        int $userId,
        string $courseId,
        ?int $moduleId,
        string $type,
        string $title,
        string $message,
        array $data = []
    ): Notification {
        return Notification::create([
            'user_id' => $userId,
            'course_id' => $courseId,
            'module_id' => $moduleId,
            'type' => $type,
            'title' => $title,
            'message' => $message,
            'data' => $data,
        ]);
    }

    /**
     * Get sync status for a custom module across all courses.
     */
    public function getSyncStatus(CustomModule $customModule): Collection
    {
        return Course::query()
            ->with('instructor:id,fullname')
            ->get()
            ->map(function ($course) use ($customModule) {
                $syncedModule = $course->modules()
                    ->where('custom_module_id', $customModule->id)
                    ->first();

                $enrollmentCount = Enrollment::where('course_id', $course->id)
                    ->where('status', '!=', 'Dropped')
                    ->count();

                return [
                    'course_id' => $course->id,
                    'course_title' => $course->title,
                    'department' => $course->department,
                    'instructor' => $course->instructor?->fullname,
                    'is_synced' => (bool) $syncedModule,
                    'synced_at' => $syncedModule?->updated_at,
                    'enrolled_users' => $enrollmentCount,
                ];
            });
    }
}
