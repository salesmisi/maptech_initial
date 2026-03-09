<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Module;
use App\Models\User;
use App\Models\Enrollment;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Exception;

class CourseController extends Controller
{
    /**
     * Get all courses.
     */
    public function index(Request $request)
    {
        // Eager-load instructor and modules so API returns module data/count
        $query = Course::with(['instructor:id,fullname,email', 'modules'])
            ->withCount('enrollments');

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

        // Transform the data to include enrollment counts
        $courses->each(function ($course) {
            $course->enrolled_count = $course->enrollments->count();
            $course->completed_count = $course->enrollments->where('status', 'Completed')->count();
        });

        return response()->json($courses);
    }

    /**
     * Create a new course.
     */
    public function store(Request $request)
    {
        Log::info('Request received for course creation', [
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
                'subdepartment_id' => 'nullable|exists:subdepartments,id',
                'instructor_id' => 'nullable|exists:users,id',
                'status' => ['nullable', Rule::in(['Active', 'Inactive', 'Draft'])],
                'start_date' => 'nullable|date',
                'deadline' => 'nullable|date',
                'modules' => 'nullable|array',
                'modules.*.title' => 'nullable|string|max:255',
                'modules.*.content' => 'nullable|file|max:102400',
            ]);

            Log::info('Validation successful', [
                'validated_keys' => array_keys($validated),
                'has_modules' => isset($validated['modules']),
                'modules_count' => isset($validated['modules']) ? count($validated['modules']) : 0,
            ]);

            $course = Course::create([
                'title' => $validated['title'],
                'description' => $validated['description'] ?? null,
                'department' => $validated['department'],
                'subdepartment_id' => $validated['subdepartment_id'] ?? null,
                'instructor_id' => $validated['instructor_id'] ?? null,
                'status' => $validated['status'] ?? 'Active',
                'start_date' => $validated['start_date'] ?? null,
                'deadline' => $validated['deadline'] ?? null,
            ]);

            Log::info('Course created', $course->toArray());

            if (!empty($validated['modules'])) {
                Log::info('Processing modules', ['count' => count($validated['modules'])]);
                foreach ($validated['modules'] as $index => $module) {
                    Log::info("Processing module {$index}", [
                        'title' => $module['title'] ?? 'NO TITLE',
                        'has_content' => isset($module['content']),
                    ]);

                    if (isset($module['content']) && $module['content'] instanceof \Illuminate\Http\UploadedFile) {
                        $filePath = $module['content']->store('course-content', 'public');
                        Log::info("File stored at: {$filePath}");
                        $course->modules()->create([
                            'title' => $module['title'] ?? 'Untitled Module',
                            'content_path' => $filePath,
                        ]);
                    } else {
                        Log::warning("Module {$index} has no valid content file");
                    }
                }
            } else {
                Log::info('No modules to process');
            }

            return response()->json([
                'message' => 'Course created successfully',
                'course' => $course->load('instructor:id,fullname,email', 'modules')
            ], 201);
        } catch (ValidationException $e) {
            Log::error('Validation failed', $e->errors());
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $e->errors()
            ], 422);
        } catch (Exception $e) {
            Log::error('An error occurred', ['error' => $e->getMessage()]);
            return response()->json([
                'message' => 'An error occurred while creating the course',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get a specific course with modules and enrolled users.
     */
    public function show(string $id)
    {
        $course = Course::with([
            'instructor:id,fullname,email',
            'modules.lessons',
            'enrolledUsers:id,fullname,email,department,role,status',
        ])->findOrFail($id);

        // Recalculate progress for each enrolled user
        foreach ($course->enrolledUsers as $eu) {
            Enrollment::recalculateProgress($eu->id, $course->id);
        }
        // Refresh to get updated pivot data
        $course->load('enrolledUsers:id,fullname,email,department,role,status');

        return response()->json($course);
    }

    /**
     * Update a course.
     */
    public function update(Request $request, string $id)
    {
        $course = Course::findOrFail($id);

        Log::info('Request received for course update', [
            'id' => $id,
            'all_keys' => array_keys($request->all()),
            'has_files' => $request->hasFile('modules'),
        ]);

        try {
            $validated = $request->validate([
                'title' => 'sometimes|string|max:255',
                'description' => 'nullable|string',
                'department' => 'sometimes|string|max:255',
                'subdepartment_id' => 'nullable|exists:subdepartments,id',
                'instructor_id' => 'nullable|exists:users,id',
                'status' => ['sometimes', Rule::in(['Active', 'Inactive', 'Draft'])],
                'start_date' => 'nullable|date',
                'deadline' => 'nullable|date',
                'modules' => 'nullable|array',
                'modules.*.title' => 'nullable|string|max:255',
                'modules.*.content' => 'nullable|file|max:102400',
            ]);

            $course->update(array_filter($validated, function ($k) {
                return in_array($k, ['title', 'description', 'department', 'subdepartment_id', 'instructor_id', 'status', 'start_date', 'deadline']);
            }, ARRAY_FILTER_USE_KEY));

            if (!empty($validated['modules'])) {
                Log::info('Processing modules for update', ['count' => count($validated['modules'])]);
                foreach ($validated['modules'] as $index => $module) {
                    Log::info("Processing module {$index}", [
                        'title' => $module['title'] ?? 'NO TITLE',
                        'has_content' => isset($module['content']),
                    ]);

                    if (isset($module['content']) && $module['content'] instanceof \Illuminate\Http\UploadedFile) {
                        $filePath = $module['content']->store('course-content', 'public');
                        Log::info("File stored at: {$filePath}");
                        $course->modules()->create([
                            'title' => $module['title'] ?? 'Untitled Module',
                            'content_path' => $filePath,
                        ]);
                    } else {
                        Log::warning("Module {$index} has no valid content file");
                    }
                }
            } else {
                Log::info('No modules to process on update');
            }

            return response()->json([
                'message' => 'Course updated successfully',
                'course' => $course->load('instructor:id,fullname,email', 'modules')
            ]);
        } catch (ValidationException $e) {
            Log::error('Validation failed on update', $e->errors());
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $e->errors()
            ], 422);
        } catch (Exception $e) {
            Log::error('An error occurred on update', ['error' => $e->getMessage()]);
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

    /**
     * List all enrolled users for a course.
     */
    public function enrollments(string $id)
    {
        $course = Course::findOrFail($id);

        // Recalculate progress for each enrollment
        foreach ($course->enrollments as $enrollment) {
            Enrollment::recalculateProgress($enrollment->user_id, $course->id);
        }

        $users = $course->enrolledUsers()
            ->select('users.id', 'users.fullname', 'users.email', 'users.department', 'users.role', 'users.status')
            ->get()
            ->map(function ($user) {
                return [
                    'id'          => $user->id,
                    'fullname'    => $user->fullname,
                    'email'       => $user->email,
                    'department'  => $user->department,
                    'role'        => $user->role,
                    'status'      => $user->status,
                    'enrolled_at' => $user->pivot->enrolled_at,
                    'progress'    => $user->pivot->progress,
                    'enrollment_status' => $user->pivot->status,
                ];
            });

        return response()->json($users);
    }

    /**
     * Enroll a user into a course.
     */
    public function enroll(Request $request, string $id)
    {
        $request->validate([
            'user_id' => 'required|exists:users,id',
        ]);

        $course = Course::findOrFail($id);

        if ($course->enrollments()->where('user_id', $request->user_id)->exists()) {
            return response()->json(['message' => 'User is already enrolled in this course'], 409);
        }

        $course->enrollments()->create([
            'user_id'     => $request->user_id,
            'status'      => 'Active',
            'progress'    => 0,
            'enrolled_at' => now(),
        ]);

        $user = User::select('id', 'fullname', 'email', 'department', 'role', 'status')->findOrFail($request->user_id);

        return response()->json([
            'message' => 'User enrolled successfully',
            'user'    => $user,
        ], 201);
    }

    /**
     * Remove an enrollment (unenroll a user).
     */
    public function unenroll(string $courseId, int $userId)
    {
        $course = Course::findOrFail($courseId);
        $deleted = $course->enrollments()->where('user_id', $userId)->delete();

        if (!$deleted) {
            return response()->json(['message' => 'Enrollment not found'], 404);
        }

        return response()->json(['message' => 'User unenrolled successfully']);
    }

    /**
     * Add a standalone module to a course (without file initially).
     */
    public function addModule(Request $request, string $id)
    {
        $request->validate([
            'title'       => 'required|string|max:255',
            'description' => 'nullable|string',
            'content'     => 'nullable|file|max:102400',
        ]);

        $course = Course::findOrFail($id);

        $nextOrder = $course->modules()->max('order') + 1;

        $data = [
            'title'       => $request->input('title'),
            'description' => $request->input('description'),
            'order'       => $nextOrder,
        ];

        if ($request->hasFile('content')) {
            $data['content_path'] = $request->file('content')->store('course-content', 'public');
        }

        $module = $course->modules()->create($data);

        return response()->json([
            'message' => 'Module added successfully',
            'module'  => $module,
        ], 201);
    }

    /**
     * Delete a module from a course.
     */
    public function deleteModule(string $courseId, int $moduleId)
    {
        $course = Course::findOrFail($courseId);
        $module = $course->modules()->findOrFail($moduleId);
        $module->delete();

        return response()->json(['message' => 'Module deleted successfully']);
    }

    /**
     * Add a lesson to a module.
     */
    public function addLesson(Request $request, int $moduleId)
    {
        $module = Module::findOrFail($moduleId);

        $request->validate([
            'title'        => 'required|string|max:255',
            'text_content' => 'nullable|string',
            'content'      => 'nullable|file|max:102400',
        ]);

        $nextOrder = $module->lessons()->max('order') + 1;

        $data = [
            'title'        => $request->input('title'),
            'text_content' => $request->input('text_content'),
            'order'        => $nextOrder,
        ];

        if ($request->hasFile('content')) {
            $data['content_path'] = $request->file('content')->store('course-content', 'public');
        }

        $lesson = $module->lessons()->create($data);

        return response()->json(['message' => 'Lesson added', 'lesson' => $lesson], 201);
    }

    /**
     * Delete a lesson from a module.
     */
    public function deleteLesson(int $moduleId, int $lessonId)
    {
        $module = Module::findOrFail($moduleId);
        $lesson = $module->lessons()->findOrFail($lessonId);

        if ($lesson->content_path) {
            Storage::disk('public')->delete($lesson->content_path);
        }

        $lesson->delete();

        return response()->json(['message' => 'Lesson deleted']);
    }

    /**
     * Update a module (title / description).
     */
    public function updateModule(Request $request, string $courseId, int $moduleId)
    {
        $course = Course::findOrFail($courseId);
        $module = $course->modules()->findOrFail($moduleId);

        $validated = $request->validate([
            'title'       => 'sometimes|string|max:255',
            'description' => 'nullable|string',
        ]);

        $module->update($validated);

        return response()->json(['message' => 'Module updated', 'module' => $module->fresh()]);
    }

    /**
     * Update a lesson (title / text_content). Optionally replace file.
     */
    public function updateLesson(Request $request, int $moduleId, int $lessonId)
    {
        $module = Module::findOrFail($moduleId);
        $lesson = $module->lessons()->findOrFail($lessonId);

        $request->validate([
            'title'        => 'sometimes|string|max:255',
            'text_content' => 'nullable|string',
            'content'      => 'nullable|file|max:102400',
        ]);

        if ($request->has('title')) $lesson->title = $request->input('title');
        if ($request->has('text_content')) $lesson->text_content = $request->input('text_content');

        if ($request->hasFile('content')) {
            if ($lesson->content_path) {
                Storage::disk('public')->delete($lesson->content_path);
            }
            $lesson->content_path = $request->file('content')->store('course-content', 'public');
        }

        $lesson->save();

        return response()->json(['message' => 'Lesson updated', 'lesson' => $lesson->fresh()]);
    }

    /**
     * Reorder modules for a course.
     */
    public function reorderModules(Request $request, string $courseId)
    {
        $course = Course::findOrFail($courseId);

        $request->validate([
            'order'   => 'required|array',
            'order.*' => 'integer|exists:modules,id',
        ]);

        foreach ($request->input('order') as $index => $moduleId) {
            $course->modules()->where('id', $moduleId)->update(['order' => $index + 1]);
        }

        return response()->json(['message' => 'Modules reordered']);
    }
}
