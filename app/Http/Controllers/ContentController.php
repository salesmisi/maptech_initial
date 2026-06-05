<?php

namespace App\Http\Controllers;

use App\Models\Course;
use App\Models\Module;
use App\Models\Lesson;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Exception;
use Illuminate\Support\Facades\Auth;

class ContentController extends Controller
{
    // ─── MODULES ────────────────────────────────────────────────────────

    /**
     * List modules (with lessons) for a given course.
     */
    public function modulesByCourse(string $courseId)
    {
        $course = Course::with('modules.lessons')->findOrFail($courseId);

        /** @var \App\Models\User|null $user */
        $user = Auth::user();

        // If the requester is an employee, only allow access to courses for their department
        if ($user && $user->isEmployee()) {
            if (!$user->department) {
                return response()->json(['message' => 'User has no department assigned'], 403);
            }

            if (strtolower($user->department) !== strtolower($course->department)) {
                return response()->json(['message' => 'Forbidden: course not in your department'], 403);
            }
        }

        return response()->json($course->modules);
    }

    /**
     * Create a new module for a course.
     */
    public function storeModule(Request $request, string $courseId)
    {
        /** @var \App\Models\User|null $user */
        $user = $request->user();
        if ($user && $user->isEmployee()) {
            // Allow if user is in IT department and the course belongs to IT
            $course = Course::findOrFail($courseId);
            if (strtolower($user->department) !== 'it' || strtolower($course->department) !== 'it') {
                return response()->json(['message' => 'Forbidden: employees cannot create modules'], 403);
            }
        }

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
        /** @var \App\Models\User|null $user */
        $user = $request->user();
        if ($user && $user->isEmployee()) {
            $module = Module::findOrFail($moduleId);
            $course = $module->course;
            if (strtolower($user->department) !== 'it' || strtolower($course->department) !== 'it') {
                return response()->json(['message' => 'Forbidden: employees cannot update modules'], 403);
            }
        } else {
            $module = Module::findOrFail($moduleId);
        }

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
        /** @var \App\Models\User|null $user */
        $user = Auth::user();
        if ($user && $user->isEmployee()) {
            $module = Module::with('lessons')->findOrFail($moduleId);
            $course = $module->course;
            if (strtolower($user->department) !== 'it' || strtolower($course->department) !== 'it') {
                return response()->json(['message' => 'Forbidden: employees cannot delete modules'], 403);
            }
        } else {
            $module = Module::with('lessons')->findOrFail($moduleId);
        }

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
        /** @var \App\Models\User|null $user */
        $user = $request->user();
        if ($user && $user->isEmployee()) {
            $module = Module::findOrFail($moduleId);
            $course = $module->course;
            if (strtolower($user->department) !== 'it' || strtolower($course->department) !== 'it') {
                return response()->json(['message' => 'Forbidden: employees cannot create lessons'], 403);
            }
        } else {
            $module = Module::findOrFail($moduleId);
        }

        $validated = $request->validate([
            'title'   => 'required|string|max:255',
            'type'    => 'required|in:Video,Document,Text',
            'status'  => 'nullable|in:Published,Draft',
            'content' => 'nullable|file|max:512000', // up to 500 MB
            'text_content' => 'nullable|string',
            'duration' => 'nullable|string|max:50', // e.g. "1:23" from frontend
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

                // Use frontend-provided duration for videos if available
                if ($validated['type'] === 'Video' && !empty($validated['duration'])) {
                    $duration = $validated['duration'];
                } else {
                    $duration = $validated['type'] === 'Video' ? $this->estimateVideoDuration($bytes) : $this->estimateReadTime($bytes);
                }
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
        /** @var \App\Models\User|null $user */
        $user = $request->user();
        if ($user && $user->isEmployee()) {
            $lesson = Lesson::findOrFail($lessonId);
            $course = $lesson->module->course;
            if (strtolower($user->department) !== 'it' || strtolower($course->department) !== 'it') {
                return response()->json(['message' => 'Forbidden: employees cannot update lessons'], 403);
            }
        } else {
            $lesson = Lesson::findOrFail($lessonId);
        }

        $validated = $request->validate([
            'title'  => 'sometimes|required|string|max:255',
            'status' => 'sometimes|in:Published,Draft',
            'text_content' => 'nullable|string',
            'content' => 'nullable|file|max:512000',
            'duration' => 'nullable|string|max:50',
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

            // Use frontend-provided duration for videos if available
            if ($lesson->type === 'Video' && !empty($validated['duration'])) {
                $lesson->duration = $validated['duration'];
            } else {
                $lesson->duration = $lesson->type === 'Video'
                    ? $this->estimateVideoDuration($bytes)
                    : $this->estimateReadTime($bytes);
            }
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
        /** @var \App\Models\User|null $user */
        $user = Auth::user();
        if ($user && $user->isEmployee()) {
            $lesson = Lesson::findOrFail($lessonId);
            $course = $lesson->module->course;
            if (strtolower($user->department) !== 'it' || strtolower($course->department) !== 'it') {
                return response()->json(['message' => 'Forbidden: employees cannot delete lessons'], 403);
            }
        } else {
            $lesson = Lesson::findOrFail($lessonId);
        }

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
