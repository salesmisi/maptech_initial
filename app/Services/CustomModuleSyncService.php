<?php

namespace App\Services;

use App\Models\CustomModule;
use App\Models\CustomLesson;
use App\Models\Module;
use App\Models\Lesson;
use App\Models\Course;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CustomModuleSyncService
{
    /**
     * Sync a custom module to all courses that have it linked.
     */
    public function syncToAllCourses(CustomModule $customModule): void
    {
        if ($customModule->status !== 'published') {
            return;
        }

        $syncedModules = Module::where('custom_module_id', $customModule->id)->get();

        foreach ($syncedModules as $module) {
            $this->syncModuleContent($customModule, $module);
        }
    }

    /**
     * Sync a custom module to a specific course.
     */
    public function syncToCourse(CustomModule $customModule, Course $course): Module
    {
        return DB::transaction(function () use ($customModule, $course) {
            // Check if already synced to this course
            $existingModule = $course->modules()
                ->where('custom_module_id', $customModule->id)
                ->first();

            if ($existingModule) {
                $this->syncModuleContent($customModule, $existingModule);
                return $existingModule->fresh(['lessons']);
            }

            // Create new module in course
            $maxOrder = $course->modules()->max('order') ?? 0;

            $newModule = $course->modules()->create([
                'custom_module_id' => $customModule->id,
                'title' => $customModule->title,
                'description' => $customModule->description,
                'logo_path' => $customModule->thumbnail_path,
                'order' => $maxOrder + 1,
            ]);

            // Create lessons
            $this->syncLessons($customModule, $newModule);

            Log::info('Custom module synced to course', [
                'custom_module_id' => $customModule->id,
                'course_id' => $course->id,
                'module_id' => $newModule->id,
            ]);

            return $newModule->fresh(['lessons']);
        });
    }

    /**
     * Sync module content (title, description, lessons) from custom module to course module.
     */
    protected function syncModuleContent(CustomModule $customModule, Module $module): void
    {
        DB::transaction(function () use ($customModule, $module) {
            // Update module basic info
            $module->update([
                'title' => $customModule->title,
                'description' => $customModule->description,
                'logo_path' => $customModule->thumbnail_path,
            ]);

            // Sync lessons
            $this->syncLessons($customModule, $module);
        });
    }

    /**
     * Sync lessons from custom module to course module.
     */
    protected function syncLessons(CustomModule $customModule, Module $module): void
    {
        $customLessons = $customModule->lessons()->orderBy('order')->get();
        $existingLessons = $module->lessons()->whereNotNull('custom_lesson_id')->get()->keyBy('custom_lesson_id');
        $processedIds = [];

        foreach ($customLessons as $customLesson) {
            $lessonData = $this->mapCustomLessonToLesson($customLesson, $module->id);

            if (isset($existingLessons[$customLesson->id])) {
                // Update existing lesson
                $existingLessons[$customLesson->id]->update($lessonData);
                $processedIds[] = $customLesson->id;
            } else {
                // Create new lesson
                $module->lessons()->create($lessonData);
                $processedIds[] = $customLesson->id;
            }
        }

        // Remove lessons that no longer exist in custom module
        $module->lessons()
            ->whereNotNull('custom_lesson_id')
            ->whereNotIn('custom_lesson_id', $processedIds)
            ->delete();
    }

    /**
     * Map custom lesson data to course lesson data.
     */
    protected function mapCustomLessonToLesson(CustomLesson $customLesson, int $moduleId): array
    {
        return [
            'module_id' => $moduleId,
            'custom_lesson_id' => $customLesson->id,
            'title' => $customLesson->title,
            'type' => $this->mapContentType($customLesson->content_type),
            'text_content' => $customLesson->text_content,
            'content_path' => $this->getContentPath($customLesson),
            'duration' => $customLesson->duration,
            'file_size' => $customLesson->file_size,
            'status' => $customLesson->status === 'published' ? 'Active' : 'Draft',
            'order' => $customLesson->order,
        ];
    }

    /**
     * Map custom lesson content type to course lesson type.
     */
    protected function mapContentType(string $contentType): string
    {
        $typeMap = [
            'text' => 'Text',
            'video' => 'Video',
            'file' => 'Document',
            'link' => 'Link',
            'quiz' => 'Quiz',
        ];

        return $typeMap[$contentType] ?? 'Text';
    }

    /**
     * Get the content path for a custom lesson.
     */
    protected function getContentPath(CustomLesson $customLesson): ?string
    {
        // For links and video URLs, use content_url
        if (in_array($customLesson->content_type, ['link', 'video']) && $customLesson->content_url) {
            return $customLesson->content_url;
        }

        // For files, use content_path
        return $customLesson->content_path;
    }

    /**
     * Remove sync between a custom module and a course.
     */
    public function unsyncFromCourse(CustomModule $customModule, Course $course): bool
    {
        $module = $course->modules()
            ->where('custom_module_id', $customModule->id)
            ->first();

        if (!$module) {
            return false;
        }

        // Remove the custom_module_id link but keep the module
        $module->update(['custom_module_id' => null]);

        // Also remove custom_lesson_id links from lessons
        $module->lessons()->update(['custom_lesson_id' => null]);

        return true;
    }

    /**
     * Get all courses where a custom module is synced.
     */
    public function getSyncedCourses(CustomModule $customModule): \Illuminate\Database\Eloquent\Collection
    {
        return Course::whereHas('modules', function ($query) use ($customModule) {
            $query->where('custom_module_id', $customModule->id);
        })->get();
    }

    /**
     * Check if a custom module is synced to a specific course.
     */
    public function isSyncedToCourse(CustomModule $customModule, Course $course): bool
    {
        return $course->modules()
            ->where('custom_module_id', $customModule->id)
            ->exists();
    }
}
