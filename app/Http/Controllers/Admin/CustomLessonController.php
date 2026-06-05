<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CustomModule;
use App\Models\CustomLesson;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;
use Exception;

class CustomLessonController extends Controller
{
    /**
     * Get all lessons for a custom module.
     */
    public function index(int $moduleId)
    {
        $module = CustomModule::findOrFail($moduleId);

        $lessons = $module->lessons()
            ->orderBy('order')
            ->get();

        return response()->json($lessons);
    }

    /**
     * Get a single lesson.
     */
    public function show(int $moduleId, int $lessonId)
    {
        $lesson = CustomLesson::where('custom_module_id', $moduleId)
            ->with('quiz')
            ->findOrFail($lessonId);

        return response()->json($lesson);
    }

    /**
     * Create a new lesson.
     */
    public function store(Request $request, int $moduleId)
    {
        $module = CustomModule::findOrFail($moduleId);

        Log::info('Creating custom lesson', [
            'module_id' => $moduleId,
            'title' => $request->input('title'),
            'content_type' => $request->input('content_type'),
        ]);

        try {
            // Determine max file size based on content type
            $maxFileSize = 5242880; // Default 5GB in KB for video files
            if ($request->input('content_type') === 'file' && $request->input('content_type') !== 'video') {
                $maxFileSize = 512000; // 500MB for non-video files
            }

            $validated = $request->validate([
                'title' => 'required|string|max:255',
                'description' => 'nullable|string',
                'content_type' => ['required', Rule::in(['text', 'video', 'file', 'link', 'quiz'])],
                'text_content' => 'nullable|string',
                'content_url' => 'nullable|url',
                'content_file' => 'nullable|file|max:' . $maxFileSize,
                'quiz_id' => 'nullable|exists:quizzes,id',
                'duration' => 'nullable|integer|min:0',
                'status' => ['nullable', Rule::in(['draft', 'published'])],
            ]);

            // Handle file upload
            $filePath = null;
            $fileName = null;
            $fileType = null;
            $fileSize = null;

            if ($request->hasFile('content_file')) {
                $file = $request->file('content_file');
                $filePath = $file->store('custom-modules/lessons', 'public');
                $fileName = $file->getClientOriginalName();
                $fileType = $file->getMimeType();
                $fileSize = $file->getSize();
            }

            // Get max order
            $maxOrder = $module->lessons()->max('order') ?? 0;

            $lesson = CustomLesson::create([
                'custom_module_id' => $moduleId,
                'title' => $validated['title'],
                'description' => $validated['description'] ?? null,
                'content_type' => $validated['content_type'],
                'text_content' => $validated['text_content'] ?? null,
                'content_path' => $filePath,
                'content_url' => $validated['content_url'] ?? null,
                'file_name' => $fileName,
                'file_type' => $fileType,
                'file_size' => $fileSize,
                'duration' => $validated['duration'] ?? null,
                'quiz_id' => $validated['quiz_id'] ?? null,
                'order' => $maxOrder + 1,
                'status' => $validated['status'] ?? 'draft',
            ]);

            Log::info('Custom lesson created', ['id' => $lesson->id]);

            // If module is published, sync this lesson to course modules
            if ($module->status === 'published') {
                $module->syncToCourseModules();
            }

            return response()->json([
                'message' => 'Lesson created successfully',
                'lesson' => $lesson,
            ], 201);
        } catch (ValidationException $e) {
            Log::error('Validation failed', $e->errors());
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (Exception $e) {
            Log::error('Error creating lesson', ['error' => $e->getMessage()]);
            return response()->json([
                'message' => 'An error occurred while creating the lesson',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update a lesson.
     */
    public function update(Request $request, int $moduleId, int $lessonId)
    {
        $module = CustomModule::findOrFail($moduleId);
        $lesson = CustomLesson::where('custom_module_id', $moduleId)->findOrFail($lessonId);

        Log::info('Updating custom lesson', ['id' => $lessonId]);

        try {
            // Determine max file size based on content type
            $maxFileSize = 5242880; // Default 5GB in KB for video files
            if ($request->input('content_type') === 'file' && $request->input('content_type') !== 'video') {
                $maxFileSize = 512000; // 500MB for non-video files
            }

            $validated = $request->validate([
                'title' => 'sometimes|string|max:255',
                'description' => 'nullable|string',
                'content_type' => ['sometimes', Rule::in(['text', 'video', 'file', 'link', 'quiz'])],
                'text_content' => 'nullable|string',
                'content_url' => 'nullable|url',
                'content_file' => 'nullable|file|max:' . $maxFileSize,
                'quiz_id' => 'nullable|exists:quizzes,id',
                'duration' => 'nullable|integer|min:0',
                'order' => 'nullable|integer|min:0',
                'status' => ['sometimes', Rule::in(['draft', 'published'])],
            ]);

            // Handle file upload
            if ($request->hasFile('content_file')) {
                // Delete old file
                if ($lesson->content_path && !preg_match('#^https?://#i', $lesson->content_path)) {
                    Storage::disk('public')->delete($lesson->content_path);
                }

                $file = $request->file('content_file');
                $validated['content_path'] = $file->store('custom-modules/lessons', 'public');
                $validated['file_name'] = $file->getClientOriginalName();
                $validated['file_type'] = $file->getMimeType();
                $validated['file_size'] = $file->getSize();
            }

            $lesson->update($validated);

            // If module is published, sync to course modules
            if ($module->status === 'published') {
                $module->syncToCourseModules();
            }

            Log::info('Custom lesson updated', ['id' => $lesson->id]);

            return response()->json([
                'message' => 'Lesson updated successfully',
                'lesson' => $lesson->fresh(),
            ]);
        } catch (ValidationException $e) {
            Log::error('Validation failed', $e->errors());
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (Exception $e) {
            Log::error('Error updating lesson', ['error' => $e->getMessage()]);
            return response()->json([
                'message' => 'An error occurred while updating the lesson',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete a lesson.
     */
    public function destroy(int $moduleId, int $lessonId)
    {
        $module = CustomModule::findOrFail($moduleId);
        $lesson = CustomLesson::where('custom_module_id', $moduleId)->findOrFail($lessonId);

        try {
            // Delete file
            if ($lesson->content_path && !preg_match('#^https?://#i', $lesson->content_path)) {
                Storage::disk('public')->delete($lesson->content_path);
            }

            $lesson->delete();

            // Sync to course modules if published
            if ($module->status === 'published') {
                $module->syncToCourseModules();
            }

            Log::info('Custom lesson deleted', ['id' => $lessonId]);

            return response()->json([
                'message' => 'Lesson deleted successfully',
            ]);
        } catch (Exception $e) {
            Log::error('Error deleting lesson', ['error' => $e->getMessage()]);
            return response()->json([
                'message' => 'An error occurred while deleting the lesson',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Reorder lessons within a module.
     */
    public function reorder(Request $request, int $moduleId)
    {
        $module = CustomModule::findOrFail($moduleId);

        $validated = $request->validate([
            'lessons' => 'required|array',
            'lessons.*.id' => 'required|exists:custom_lessons,id',
            'lessons.*.order' => 'required|integer|min:0',
        ]);

        DB::transaction(function () use ($validated, $moduleId) {
            foreach ($validated['lessons'] as $item) {
                CustomLesson::where('id', $item['id'])
                    ->where('custom_module_id', $moduleId)
                    ->update(['order' => $item['order']]);
            }
        });

        // Sync to course modules if published
        if ($module->status === 'published') {
            $module->syncToCourseModules();
        }

        return response()->json([
            'message' => 'Lessons reordered successfully',
        ]);
    }

    /**
     * Serve lesson content file.
     */
    public function content(int $moduleId, int $lessonId)
    {
        $lesson = CustomLesson::where('custom_module_id', $moduleId)->findOrFail($lessonId);

        if (!$lesson->content_path) {
            return response()->json(['message' => 'No content file'], 404);
        }

        if (preg_match('#^https?://#i', $lesson->content_path)) {
            return redirect($lesson->content_path);
        }

        $path = Storage::disk('public')->path($lesson->content_path);

        if (!file_exists($path)) {
            return response()->json(['message' => 'File not found'], 404);
        }

        return response()->file($path, [
            'Content-Type' => $lesson->file_type ?? 'application/octet-stream',
            'Content-Disposition' => 'inline; filename="' . ($lesson->file_name ?? basename($path)) . '"',
        ]);
    }
}
