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
use Illuminate\Support\Facades\DB;
use Exception;
use App\Models\Notification;

class CourseController extends Controller
{
    /**
     * Get all courses.
     */
    public function index(Request $request)
    {
        // Eager-load instructor and modules so API returns module data/count
        $query = Course::with(['instructor:id,fullname,email,profile_picture', 'modules'])
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

        // Filter by subdepartment
        if ($request->filled('subdepartment_id')) {
            $query->where('subdepartment_id', (int) $request->input('subdepartment_id'));
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
                'logo' => 'nullable|image|mimes:png,jpg,jpeg,svg|max:2048',
                'modules' => 'nullable|array',
                'modules.*.title' => 'nullable|string|max:255',
                'modules.*.content' => 'nullable|file|max:102400',
            ]);

            Log::info('Validation successful', [
                'validated_keys' => array_keys($validated),
                'has_modules' => isset($validated['modules']),
                'modules_count' => isset($validated['modules']) ? count($validated['modules']) : 0,
            ]);

            // Handle logo upload
            $logoPath = null;
            if ($request->hasFile('logo')) {
                $logoPath = $request->file('logo')->store('course-logos', 'public');
            }

            $course = Course::create([
                'title' => $validated['title'],
                'description' => $validated['description'] ?? null,
                'department' => $validated['department'],
                'subdepartment_id' => $validated['subdepartment_id'] ?? null,
                'instructor_id' => $validated['instructor_id'] ?? null,
                'status' => $validated['status'] ?? 'Active',
                'start_date' => $validated['start_date'] ?? null,
                'deadline' => $validated['deadline'] ?? null,
                'logo_path' => $logoPath,
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
                'course' => $course->load('instructor:id,fullname,email,profile_picture', 'modules')
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
            'instructor:id,fullname,email,profile_picture',
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
                'logo' => 'nullable|image|mimes:png,jpg,jpeg,svg|max:2048',
                'remove_logo' => 'nullable|boolean',
                'modules' => 'nullable|array',
                'modules.*.title' => 'nullable|string|max:255',
                'modules.*.content' => 'nullable|file|max:102400',
            ]);

            // Handle logo
            if ($request->hasFile('logo')) {
                // Delete old logo if exists
                if ($course->logo_path) {
                    Storage::disk('public')->delete($course->logo_path);
                }
                $course->logo_path = $request->file('logo')->store('course-logos', 'public');
            } elseif ($request->input('remove_logo')) {
                if ($course->logo_path) {
                    Storage::disk('public')->delete($course->logo_path);
                }
                $course->logo_path = null;
            }

            $course->update(array_filter($validated, function ($k) {
                return in_array($k, ['title', 'description', 'department', 'subdepartment_id', 'instructor_id', 'status', 'start_date', 'deadline', 'logo_path']);
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
                'course' => $course->load('instructor:id,fullname,email,profile_picture', 'modules')
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
     * Bulk assign multiple courses to an instructor (or unassign if instructor_id is null).
     */
    public function bulkAssign(Request $request)
    {
        $validated = $request->validate([
            'course_ids' => 'required|array|min:1',
            'course_ids.*' => 'required|exists:courses,id',
            'instructor_id' => 'nullable|exists:users,id',
        ]);

        $courseIds = $validated['course_ids'];
        $instructorId = $validated['instructor_id'] ?? null;

        try {
            $updated = Course::whereIn('id', $courseIds)->update(['instructor_id' => $instructorId]);

            // If an instructor was assigned, create a notification for them
            if ($instructorId) {
                $instructor = \App\Models\User::find($instructorId);
                if ($instructor) {
                    $assignedCourses = Course::whereIn('id', $courseIds)->pluck('title')->toArray();
                    $title = 'Courses assigned to you';
                    $message = 'You have been assigned ' . count($assignedCourses) . ' course(s): ' . implode(', ', array_slice($assignedCourses, 0, 5));

                    Notification::create([
                        'user_id' => $instructor->id,
                        'course_id' => null,
                        'type' => 'info',
                        'title' => $title,
                        'message' => $message,
                        'data' => [
                            'course_ids' => $courseIds,
                        ],
                    ]);

                    // Broadcast an event so the instructor can update in real-time
                    try {
                        event(new \App\Events\InstructorCoursesAssigned($instructor->id, $courseIds));
                    } catch (Exception $ex) {
                        Log::warning('Failed to broadcast InstructorCoursesAssigned', ['error' => $ex->getMessage()]);
                    }
                }
            }

            return response()->json([
                'message' => 'Bulk assignment completed',
                'updated_count' => $updated,
            ]);
        } catch (Exception $e) {
            Log::error('Bulk assign failed', ['error' => $e->getMessage(), 'course_ids' => $courseIds, 'instructor_id' => $instructorId]);
            return response()->json(['message' => 'Bulk assignment failed', 'error' => $e->getMessage()], 500);
        }
    }

    /**
     * List ALL enrollments across all courses.
     */
    public function allEnrollments(Request $request)
    {
        $query = Enrollment::with([
            'user:id,fullname,email,department,role,status',
            'course:id,title,department',
        ]);

        if ($request->has('status') && $request->status !== 'All') {
            $query->where('status', $request->status);
        }

        $enrollments = $query->orderBy('enrolled_at', 'desc')->get()->map(function ($e) {
            return [
                'id'                => $e->id,
                'user_id'           => $e->user_id,
                'course_id'         => $e->course_id,
                'employee_name'     => $e->user->fullname ?? 'Unknown',
                'employee_email'    => $e->user->email ?? '',
                'department'        => $e->user->department ?? '',
                'course_title'      => $e->course->title ?? 'Unknown',
                'course_department' => $e->course->department ?? '',
                'enrolled_at'       => $e->enrolled_at?->toDateString(),
                'progress'          => $e->progress ?? 0,
                'status'            => $e->status ?? 'Not Started',
            ];
        });

        return response()->json($enrollments);
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
                    'locked'      => $user->pivot->locked ?? false,
                ];
            });

        return response()->json($users);
    }

    /**
     * List enrolled and not-yet-enrolled employees for a specific module.
     * Enrollment is course-based, so this uses the module's course enrollments.
     */
    public function moduleEnrollmentLists(int $moduleId)
    {
        $module = Module::with('course:id,title,department')->findOrFail($moduleId);
        $course = $module->course;

        if (!$course) {
            return response()->json(['message' => 'Course not found for module'], 404);
        }

        $enrolledUsers = $course->enrolledUsers()
            ->select('users.id', 'users.fullname', 'users.email', 'users.department', 'users.role', 'users.status')
            ->orderBy('users.fullname')
            ->get()
            ->map(function ($user) {
                return [
                    'id' => $user->id,
                    'fullname' => $user->fullname,
                    'email' => $user->email,
                    'department' => $user->department,
                    'role' => $user->role,
                    'status' => $user->status,
                ];
            })
            ->values();

        $enrolledIds = $enrolledUsers->pluck('id')->all();

        $notEnrolledQuery = User::query()
            ->where('status', 'Active')
            ->whereRaw('LOWER(role) = ?', ['employee'])
            ->orderBy('fullname');

        if (!empty($enrolledIds)) {
            $notEnrolledQuery->whereNotIn('id', $enrolledIds);
        }

        // Prefer course department matching to keep admin choices relevant.
        $courseDepartment = trim((string) ($course->department ?? ''));
        if ($courseDepartment !== '') {
            $courseDepartmentLower = strtolower($courseDepartment);
            $deptRecord = DB::table('departments')
                ->select('name', 'code')
                ->whereRaw('LOWER(name) = ?', [$courseDepartmentLower])
                ->orWhereRaw('LOWER(code) = ?', [$courseDepartmentLower])
                ->first();

            $acceptedDepartments = [$courseDepartmentLower];
            if ($deptRecord) {
                $deptName = strtolower(trim((string) ($deptRecord->name ?? '')));
                $deptCode = strtolower(trim((string) ($deptRecord->code ?? '')));
                if ($deptName !== '') $acceptedDepartments[] = $deptName;
                if ($deptCode !== '') $acceptedDepartments[] = $deptCode;
            }
            $acceptedDepartments = array_values(array_unique($acceptedDepartments));

            $notEnrolledQuery->where(function ($q) use ($acceptedDepartments) {
                foreach ($acceptedDepartments as $dept) {
                    $q->orWhereRaw('LOWER(department) = ?', [$dept]);
                }
            });
        }

        $notEnrolledUsers = $notEnrolledQuery
            ->select('id', 'fullname', 'email', 'department', 'role', 'status')
            ->get();

        return response()->json([
            'module' => [
                'id' => $module->id,
                'title' => $module->title,
                'course_id' => $course->id,
                'course_title' => $course->title,
                'course_department' => $course->department,
            ],
            'not_enrolled_users' => $notEnrolledUsers,
            'enrolled_users' => $enrolledUsers,
        ]);
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
        $employee = User::select('id', 'fullname', 'email', 'department', 'role', 'status', 'subdepartment_id')
            ->findOrFail($request->user_id);

        if (strtolower((string) $employee->role) !== 'employee') {
            return response()->json(['message' => 'Only employees can be enrolled in courses.'], 422);
        }

        if ($employee->department && $course->department && $employee->department !== $course->department) {
            $courseDepartmentLower = strtolower(trim((string) $course->department));
            $employeeDepartmentLower = strtolower(trim((string) $employee->department));

            $deptRecord = DB::table('departments')
                ->select('name', 'code')
                ->whereRaw('LOWER(name) = ?', [$courseDepartmentLower])
                ->orWhereRaw('LOWER(code) = ?', [$courseDepartmentLower])
                ->first();

            $acceptedDepartments = [$courseDepartmentLower];
            if ($deptRecord) {
                $deptName = strtolower(trim((string) ($deptRecord->name ?? '')));
                $deptCode = strtolower(trim((string) ($deptRecord->code ?? '')));
                if ($deptName !== '') $acceptedDepartments[] = $deptName;
                if ($deptCode !== '') $acceptedDepartments[] = $deptCode;
            }
            $acceptedDepartments = array_values(array_unique($acceptedDepartments));

            if (!in_array($employeeDepartmentLower, $acceptedDepartments, true)) {
                return response()->json(['message' => 'Employee department does not match the selected course department.'], 422);
            }
        }

        if ($course->enrollments()->where('user_id', $request->user_id)->exists()) {
            return response()->json(['message' => 'User is already enrolled in this course'], 409);
        }

        $course->enrollments()->create([
            'user_id'     => $request->user_id,
            'progress'    => 0,
            'enrolled_at' => now(),
        ]);

        return response()->json([
            'message' => 'User enrolled successfully',
            'user'    => $employee,
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
            // Allow large video files (up to ~2 GB)
            'content'      => 'nullable|file|max:2048000',
            'content_url'  => 'nullable|url|max:2000',
            'type'         => 'nullable|in:Video,Document,Text',
            'status'       => 'nullable|in:Published,Draft',
        ]);

        $nextOrder = $module->lessons()->max('order') + 1;

        $data = [
            'title'        => $request->input('title'),
            'text_content' => $request->input('text_content'),
            'order'        => $nextOrder,
        ];

        // If provided an external content URL (YouTube embed), save it directly
        if ($request->filled('content_url')) {
            $data['content_path'] = $request->input('content_url');
        } elseif ($request->hasFile('content')) {
            $data['content_path'] = $request->file('content')->store('course-content', 'public');
        }

        if ($request->filled('type')) {
            $data['type'] = $request->input('type');
        }

        if ($request->filled('status')) {
            $data['status'] = $request->input('status');
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

    /**
     * Lock a specific enrollment.
     */
    public function lockEnrollment(Request $request, string $courseId, int $userId)
    {
        $course = Course::findOrFail($courseId);

        /** @var \App\Models\Enrollment|null $enrollment */
        $enrollment = $course->enrollments()->where('user_id', $userId)->first();
        if (!$enrollment) {
            return response()->json(['message' => 'Enrollment not found'], 404);
        }

        $enrollment->update(['locked' => true]);

        return response()->json(['message' => 'Enrollment locked']);
    }

    /**
     * Unlock an enrollment.
     */
    public function unlockEnrollment(Request $request, string $courseId, int $userId)
    {
        $request->validate([
            'duration_minutes' => 'nullable|integer|min:1',
            'expires_at' => 'nullable|date',
        ]);

        $course = Course::findOrFail($courseId);

        /** @var \App\Models\Enrollment|null $enrollment */
        $enrollment = $course->enrollments()->where('user_id', $userId)->first();
        if (!$enrollment) {
            return response()->json(['message' => 'Enrollment not found'], 404);
        }

        // compute unlocked_until if provided
        $until = null;
        if ($request->filled('duration_minutes')) {
            $until = now()->addMinutes((int) $request->input('duration_minutes'));
        } elseif ($request->filled('expires_at')) {
            $until = \Carbon\Carbon::parse($request->input('expires_at'))->setTimezone('UTC');
        }

        $data = ['locked' => false];
        if ($until) $data['unlocked_until'] = $until;

        $enrollment->update($data);

        return response()->json(['message' => 'Enrollment unlocked']);
    }

    /**
     * Lock a specific module for a given user.
     */
    public function lockModule(Request $request, string $courseId, string $moduleId, int $userId)
    {
        $course = Course::findOrFail($courseId);

        $module = Module::where('course_id', $course->id)->where('id', $moduleId)->first();
        if (!$module) return response()->json(['message' => 'Module not found'], 404);

        DB::table('module_user')->updateOrInsert(
            ['module_id' => $module->id, 'user_id' => $userId],
            ['unlocked' => false, 'unlocked_at' => null, 'unlocked_until' => null, 'updated_at' => now(), 'created_at' => now()]
        );

        return response()->json(['message' => 'Module locked for user']);
    }

    /**
     * Unlock a specific module for a given user.
     */
    public function unlockModule(Request $request, string $courseId, string $moduleId, int $userId)
    {
        $request->validate([
            'duration_minutes' => 'nullable|integer|min:1',
            'expires_at' => 'nullable|date',
        ]);

        $course = Course::findOrFail($courseId);

        $module = Module::where('course_id', $course->id)->where('id', $moduleId)->first();
        if (!$module) return response()->json(['message' => 'Module not found'], 404);

        // Upsert pivot
        $until = null;
        if ($request->filled('duration_minutes')) {
            $until = now()->addMinutes((int) $request->input('duration_minutes'));
        } elseif ($request->filled('expires_at')) {
            $until = \Carbon\Carbon::parse($request->input('expires_at'))->setTimezone('UTC');
        }

        $payload = ['unlocked' => true, 'unlocked_at' => now(), 'updated_at' => now(), 'created_at' => now()];
        if ($until) $payload['unlocked_until'] = $until;

        DB::table('module_user')->updateOrInsert(
            ['module_id' => $module->id, 'user_id' => $userId],
            $payload
        );

        return response()->json(['message' => 'Module unlocked for user']);
    }
}
