<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Log;
use Exception;

class CourseController extends Controller
{
    /**
     * Get all courses.
     */
    public function index(Request $request)
    {
        // Eager-load instructor and modules so API returns module data/count
        $query = Course::with(['instructor:id,fullname,email', 'modules']);

        // Filter by department
        if ($request->has('department')) {
            $query->where('department', $request->department);
        }

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Filter by instructor
        if ($request->has('instructor_id')) {
            $query->where('instructor_id', $request->instructor_id);
        }

        $courses = $query->orderBy('created_at', 'desc')->get();

        return response()->json($courses);
    }

    /**
     * Create a new course.
     */
    public function store(Request $request)
    {
        \Log::info('Request received for course creation', [
            'title' => $request->input('title'),
            'department' => $request->input('department'),
            'modules_count' => $request->has('modules') ? count($request->input('modules', [])) : 0,
            'modules_raw' => $request->input('modules'),
            'all_keys' => array_keys($request->all()),
            'has_files' => $request->hasFile('modules'),
        ]);

        try {
            $validated = $request->validate([
                'title' => 'required|string|max:255',
                'description' => 'nullable|string',
                'department' => 'required|string|max:255',
                'instructor_id' => 'nullable|exists:users,id',
                'status' => ['nullable', Rule::in(['Active', 'Inactive', 'Draft'])],
                'modules' => 'nullable|array',
                'modules.*.title' => 'nullable|string|max:255',
                'modules.*.content' => 'nullable|file|max:102400',
            ]);

            \Log::info('Validation successful', [
                'validated_keys' => array_keys($validated),
                'has_modules' => isset($validated['modules']),
                'modules_count' => isset($validated['modules']) ? count($validated['modules']) : 0,
            ]);

            $course = Course::create([
                'title' => $validated['title'],
                'description' => $validated['description'] ?? null,
                'department' => $validated['department'],
                'instructor_id' => $validated['instructor_id'] ?? null,
                'status' => $validated['status'] ?? 'Active',
            ]);

            \Log::info('Course created', $course->toArray());

            if (!empty($validated['modules'])) {
                \Log::info('Processing modules', ['count' => count($validated['modules'])]);
                foreach ($validated['modules'] as $index => $module) {
                    \Log::info("Processing module {$index}", [
                        'title' => $module['title'] ?? 'NO TITLE',
                        'has_content' => isset($module['content']),
                    ]);

                    if (isset($module['content']) && $module['content'] instanceof \Illuminate\Http\UploadedFile) {
                        $filePath = $module['content']->store('course-content', 'public');
                        \Log::info("File stored at: {$filePath}");
                        $course->modules()->create([
                            'title' => $module['title'] ?? 'Untitled Module',
                            'content_path' => $filePath,
                        ]);
                    } else {
                        \Log::warning("Module {$index} has no valid content file");
                    }
                }
            } else {
                \Log::info('No modules to process');
            }

            return response()->json([
                'message' => 'Course created successfully',
                'course' => $course->load('instructor:id,fullname,email', 'modules')
            ], 201);
        } catch (ValidationException $e) {
            \Log::error('Validation failed', $e->errors());
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $e->errors()
            ], 422);
        } catch (Exception $e) {
            \Log::error('An error occurred', ['error' => $e->getMessage()]);
            return response()->json([
                'message' => 'An error occurred while creating the course',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get a specific course.
     */
    public function show(string $id)
    {
        $course = Course::with(['instructor:id,fullname,email', 'modules'])->findOrFail($id);

        return response()->json($course);
    }

    /**
     * Update a course.
     */
    public function update(Request $request, string $id)
    {
        $course = Course::findOrFail($id);

        \Log::info('Request received for course update', [
            'id' => $id,
            'all_keys' => array_keys($request->all()),
            'has_files' => $request->hasFile('modules'),
        ]);

        try {
            $validated = $request->validate([
                'title' => 'sometimes|string|max:255',
                'description' => 'nullable|string',
                'department' => 'sometimes|string|max:255',
                'instructor_id' => 'nullable|exists:users,id',
                'status' => ['sometimes', Rule::in(['Active', 'Inactive', 'Draft'])],
                'modules' => 'nullable|array',
                'modules.*.title' => 'nullable|string|max:255',
                'modules.*.content' => 'nullable|file|max:102400',
            ]);

            $course->update(array_filter($validated, function ($k) {
                return in_array($k, ['title', 'description', 'department', 'instructor_id', 'status']);
            }, ARRAY_FILTER_USE_KEY));

            if (!empty($validated['modules'])) {
                \Log::info('Processing modules for update', ['count' => count($validated['modules'])]);
                foreach ($validated['modules'] as $index => $module) {
                    \Log::info("Processing module {$index}", [
                        'title' => $module['title'] ?? 'NO TITLE',
                        'has_content' => isset($module['content']),
                    ]);

                    if (isset($module['content']) && $module['content'] instanceof \Illuminate\Http\UploadedFile) {
                        $filePath = $module['content']->store('course-content', 'public');
                        \Log::info("File stored at: {$filePath}");
                        $course->modules()->create([
                            'title' => $module['title'] ?? 'Untitled Module',
                            'content_path' => $filePath,
                        ]);
                    } else {
                        \Log::warning("Module {$index} has no valid content file");
                    }
                }
            } else {
                \Log::info('No modules to process on update');
            }

            return response()->json([
                'message' => 'Course updated successfully',
                'course' => $course->load('instructor:id,fullname,email', 'modules')
            ]);
        } catch (ValidationException $e) {
            \Log::error('Validation failed on update', $e->errors());
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $e->errors()
            ], 422);
        } catch (Exception $e) {
            \Log::error('An error occurred on update', ['error' => $e->getMessage()]);
            return response()->json([
                'message' => 'An error occurred while updating the course',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete a course.
     */
    public function destroy(string $id)
    {
        $course = Course::findOrFail($id);
        $course->delete();

        return response()->json([
            'message' => 'Course deleted successfully'
        ]);
    }
}
