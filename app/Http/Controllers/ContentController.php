<?php

namespace App\Http\Controllers;

use App\Models\Course;
use App\Models\Module;
use App\Models\Lesson;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Exception;

class ContentController extends Controller
{
    // ─── MODULES ────────────────────────────────────────────────────────

    /**
     * List modules (with lessons) for a given course.
     */
    public function modulesByCourse(string $courseId)
    {
        $course = Course::with('modules.lessons')->findOrFail($courseId);

        return response()->json($course->modules);
    }

    /**
     * Create a new module for a course.
     */
    public function storeModule(Request $request, string $courseId)
    {
        $course = Course::findOrFail($courseId);

        $validated = $request->validate([
            'title' => 'required|string|max:255',
        ]);

        $maxOrder = $course->modules()->max('order') ?? -1;

        $module = $course->modules()->create([
            'title' => $validated['title'],
            'content_path' => null,
            'order' => $maxOrder + 1,
        ]);

        return response()->json($module->load('lessons'), 201);
    }

    /**
     * Update a module title.
     */
    public function updateModule(Request $request, int $moduleId)
    {
        $module = Module::findOrFail($moduleId);

        $validated = $request->validate([
            'title' => 'required|string|max:255',
        ]);

        $module->update(['title' => $validated['title']]);

        return response()->json($module->load('lessons'));
    }

    /**
     * Delete a module (cascades to lessons).
     */
    public function destroyModule(int $moduleId)
    {
        $module = Module::with('lessons')->findOrFail($moduleId);

        // Delete associated files
        foreach ($module->lessons as $lesson) {
            if ($lesson->content_path) {
                Storage::disk('public')->delete($lesson->content_path);
            }
        }

        $module->delete();

        return response()->json(['message' => 'Module deleted successfully']);
    }

    // ─── LESSONS / CONTENT ──────────────────────────────────────────────

    /**
     * Upload / create a lesson inside a module.
     */
    public function storeLesson(Request $request, int $moduleId)
    {
        $module = Module::findOrFail($moduleId);

        $validated = $request->validate([
            'title'   => 'required|string|max:255',
            'type'    => 'required|in:Video,Document,Text',
            'status'  => 'nullable|in:Published,Draft',
            'content' => 'nullable|file|max:512000', // up to 500 MB
            'text_content' => 'nullable|string',
        ]);

        $contentPath = null;
        $fileSize    = null;
        $duration    = null;
        $textContent = null;

        if ($validated['type'] === 'Text') {
            $textContent = $validated['text_content'] ?? '';
            // Estimate reading time (~200 words per minute)
            $wordCount = str_word_count($textContent);
            $minutes   = max(1, (int) ceil($wordCount / 200));
            $duration  = "{$minutes} min read";
        } else {
            if ($request->hasFile('content')) {
                $file = $request->file('content');
                $contentPath = $file->store('lessons', 'public');
                $bytes = $file->getSize();
                $fileSize = $this->formatBytes($bytes);
                $duration = $validated['type'] === 'Video' ? $this->estimateVideoDuration($bytes) : $this->estimateReadTime($bytes);
            }
        }

        $maxOrder = $module->lessons()->max('order') ?? -1;

        $lesson = $module->lessons()->create([
            'title'        => $validated['title'],
            'type'         => $validated['type'],
            'content_path' => $contentPath,
            'text_content' => $textContent,
            'duration'     => $duration,
            'file_size'    => $fileSize,
            'status'       => $validated['status'] ?? 'Draft',
            'order'        => $maxOrder + 1,
        ]);

        return response()->json($lesson, 201);
    }

    /**
     * Update a lesson.
     */
    public function updateLesson(Request $request, int $lessonId)
    {
        $lesson = Lesson::findOrFail($lessonId);

        $validated = $request->validate([
            'title'  => 'sometimes|required|string|max:255',
            'status' => 'sometimes|in:Published,Draft',
            'text_content' => 'nullable|string',
            'content' => 'nullable|file|max:512000',
        ]);

        if (isset($validated['title'])) {
            $lesson->title = $validated['title'];
        }

        if (isset($validated['status'])) {
            $lesson->status = $validated['status'];
        }

        // Replace file if a new one is uploaded
        if ($request->hasFile('content')) {
            if ($lesson->content_path) {
                Storage::disk('public')->delete($lesson->content_path);
            }
            $file = $request->file('content');
            $lesson->content_path = $file->store('lessons', 'public');
            $bytes = $file->getSize();
            $lesson->file_size = $this->formatBytes($bytes);
            $lesson->duration = $lesson->type === 'Video'
                ? $this->estimateVideoDuration($bytes)
                : $this->estimateReadTime($bytes);
        }

        if ($lesson->type === 'Text' && isset($validated['text_content'])) {
            $lesson->text_content = $validated['text_content'];
            $wordCount = str_word_count($validated['text_content']);
            $minutes = max(1, (int) ceil($wordCount / 200));
            $lesson->duration = "{$minutes} min read";
        }

        $lesson->save();

        return response()->json($lesson);
    }

    /**
     * Delete a lesson.
     */
    public function destroyLesson(int $lessonId)
    {
        $lesson = Lesson::findOrFail($lessonId);

        if ($lesson->content_path) {
            Storage::disk('public')->delete($lesson->content_path);
        }

        $lesson->delete();

        return response()->json(['message' => 'Lesson deleted successfully']);
    }

    // ─── HELPERS ────────────────────────────────────────────────────────

    private function formatBytes(int $bytes): string
    {
        if ($bytes >= 1073741824) {
            return round($bytes / 1073741824, 1) . ' GB';
        }
        if ($bytes >= 1048576) {
            return round($bytes / 1048576, 1) . ' MB';
        }
        if ($bytes >= 1024) {
            return round($bytes / 1024, 1) . ' KB';
        }
        return $bytes . ' B';
    }

    private function estimateVideoDuration(int $bytes): string
    {
        // Rough estimate: ~10 MB per minute of video
        $minutes = max(1, (int) round($bytes / (10 * 1048576)));
        $hrs = intdiv($minutes, 60);
        $mins = $minutes % 60;
        return $hrs > 0 ? sprintf('%d:%02d', $hrs, $mins) : sprintf('%d:%02d', $mins, 0);
    }

    private function estimateReadTime(int $bytes): string
    {
        // Rough: 1 page ≈ 3 KB, 2 minutes per page
        $pages = max(1, (int) round($bytes / 3072));
        $minutes = $pages * 2;
        return "{$minutes} min read";
    }
}
