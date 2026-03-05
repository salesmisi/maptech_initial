<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\CourseEnrollment;
use App\Models\Notification;
use App\Models\Module;
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
        // Eager-load instructor, modules, and enrollments with user data
        $query = Course::with([
            'instructor:id,fullName,email',
            'modules',
            'enrollments.user:id,fullName,email,department'
        ]);

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
                'course' => $course->load('instructor:id,fullName,email', 'modules')
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
        $course = Course::with([
            'instructor:id,fullName,email',
            'modules',
            'enrollments.user:id,fullName,email,department'
        ])->findOrFail($id);

        // Add enrollment counts
        $course->enrolled_count = $course->enrollments->count();
        $course->completed_count = $course->enrollments->where('status', 'Completed')->count();

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
                'course' => $course->load('instructor:id,fullName,email', 'modules')
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

    /**
     * Get enrolled students for a specific course.
     */
    public function getEnrolledStudents(string $id)
    {
        $course = Course::findOrFail($id);

        $enrollments = $course->enrollments()
            ->with('user:id,fullName,email,department')
            ->orderBy('enrolled_at', 'desc')
            ->get();

        $students = $enrollments->map(function ($enrollment) {
            return [
                'enrollment_id' => $enrollment->id,
                'id' => $enrollment->user->id,
                'name' => $enrollment->user->fullName,
                'email' => $enrollment->user->email,
                'department' => $enrollment->user->department,
                'enrolledDate' => $enrollment->enrolled_at->format('Y-m-d'),
                'progress' => $enrollment->progress,
                'status' => $enrollment->status === 'Active' ? 'Active' :
                           ($enrollment->status === 'Completed' ? 'Completed' : 'Inactive'),
                'completed_at' => $enrollment->completed_at?->format('Y-m-d'),
            ];
        });

        return response()->json($students);
    }

    /**
     * Enroll a user in a course.
     */
    public function enrollStudent(Request $request, string $courseId)
    {
        $validated = $request->validate([
            'user_id' => 'required|exists:users,id',
        ]);

        $course = Course::findOrFail($courseId);

        try {
            $enrollment = $course->enrollments()->create([
                'user_id' => $validated['user_id'],
                'enrolled_at' => now(),
            ]);

            return response()->json([
                'message' => 'Student enrolled successfully',
                'enrollment' => $enrollment->load('user:id,fullName,email,department')
            ], 201);
        } catch (\Exception $e) {
            if (str_contains($e->getMessage(), 'Duplicate entry')) {
                return response()->json([
                    'message' => 'Student is already enrolled in this course'
                ], 409);
            }

            return response()->json([
                'message' => 'Failed to enroll student'
            ], 500);
        }
    }

    /**
     * Remove a student from a course.
     */
    public function unenrollStudent(string $courseId, int $userId)
    {
        $course = Course::findOrFail($courseId);

        $enrollment = $course->enrollments()->where('user_id', $userId)->first();

        if (!$enrollment) {
            return response()->json([
                'message' => 'Student is not enrolled in this course'
            ], 404);
        }

        $enrollment->delete();

        return response()->json([
            'message' => 'Student removed from course successfully'
        ]);
    }

    /**
     * Send a quiz to enrolled students filtered by department.
     */
    public function sendQuiz(Request $request, string $courseId)
    {
        $course = Course::findOrFail($courseId);

        $validated = $request->validate([
            'module_id' => 'required|exists:modules,id',
        ]);

        $module = Module::where('id', $validated['module_id'])
            ->where('course_id', $course->id)
            ->firstOrFail();

        if (empty($module->pre_assessment)) {
            return response()->json([
                'message' => 'This module has no quiz to send.'
            ], 422);
        }

        // Get enrolled students whose department matches the course department
        $enrollments = $course->enrollments()
            ->with('user')
            ->get()
            ->filter(function ($enrollment) use ($course) {
                return $enrollment->user
                    && strcasecmp($enrollment->user->department, $course->department) === 0;
            });

        if ($enrollments->isEmpty()) {
            return response()->json([
                'message' => 'No enrolled students match the course department (' . $course->department . ').'
            ], 422);
        }

        $sent = 0;
        foreach ($enrollments as $enrollment) {
            // Prevent duplicate notifications for the same quiz
            $exists = Notification::where('user_id', $enrollment->user_id)
                ->where('course_id', $course->id)
                ->where('module_id', $module->id)
                ->where('type', 'quiz')
                ->exists();

            if (!$exists) {
                Notification::create([
                    'user_id' => $enrollment->user_id,
                    'course_id' => $course->id,
                    'module_id' => $module->id,
                    'type' => 'quiz',
                    'title' => 'New Quiz: ' . $module->title,
                    'message' => 'You have a new pre-assessment quiz for "' . $module->title . '" in course "' . $course->title . '".',
                    'data' => [
                        'quiz_questions' => $module->pre_assessment,
                        'course_title' => $course->title,
                        'module_title' => $module->title,
                    ],
                ]);
                $sent++;
            }
        }

        return response()->json([
            'message' => "Quiz sent to {$sent} {$course->department} department student(s).",
            'sent_count' => $sent,
            'department' => $course->department,
        ]);
    }
}
