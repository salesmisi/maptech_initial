<?php

namespace App\Http\Controllers\Instructor;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Module;
use App\Models\Question;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use App\Models\User;
use App\Events\EnrollmentUnlocked;
use App\Events\ModuleUnlocked;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Storage;
use Exception;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class CourseController extends Controller
{
    /**
     * Get instructor's own courses (with modules).
     */
    public function index(Request $request)
    {
        $user = $request->user();

        // scope courses to instructor ownership OR to departments/subdepartments assigned to this instructor
        $assignedSubIds = $user->subdepartments()->pluck('subdepartments.id')->toArray();
        $assignedDept = $user->department;

        $courses = Course::with(['modules.lessons'])
            ->withCount('enrollments')
            ->where(function ($q) use ($user, $assignedSubIds, $assignedDept) {
                $q->where('instructor_id', $user->id);
                if (!empty($assignedSubIds) || $assignedDept) {
                    $q->orWhere(function ($q2) use ($assignedSubIds, $assignedDept) {
                        if (!empty($assignedSubIds)) $q2->whereIn('subdepartment_id', $assignedSubIds);
                        if ($assignedDept) $q2->orWhere('department', $assignedDept);
                    });
                }
            })
            ->orderBy('created_at', 'desc')
            ->get();

        try {
            Log::info('Instructor::index returning courses', [
                'user_id' => $user->id,
                'count' => $courses->count(),
                'course_ids' => $courses->pluck('id')->toArray(),
            ]);
        } catch (\Exception $e) {
            // ignore logging failures
        }

        return response()->json($courses);
    }

    /**
     * Get instructor dashboard with live stats, chart data, and Q&A.
     */
    public function dashboard(Request $request)
    {
        $user = $request->user();

        // IDs scoped to this instructor or to assigned departments/subdepartments
        $assignedSubIds = $user->subdepartments()->pluck('subdepartments.id')->toArray();
        $assignedDept = $user->department;

        $courseQueryForIds = Course::where(function ($q) use ($user, $assignedSubIds, $assignedDept) {
            $q->where('instructor_id', $user->id);
            if (!empty($assignedSubIds) || $assignedDept) {
                $q->orWhere(function ($q2) use ($assignedSubIds, $assignedDept) {
                    if (!empty($assignedSubIds)) $q2->whereIn('subdepartment_id', $assignedSubIds);
                    if ($assignedDept) $q2->orWhere('department', $assignedDept);
                });
            }
        });

        $courseIds = $courseQueryForIds->pluck('id');
        $quizIds   = Quiz::whereIn('course_id', $courseIds)->pluck('id');

        // ── Stats ────────────────────────────────────────────────────────────
        $totalCourses  = $courseIds->count();
        $totalStudents = Enrollment::whereIn('course_id', $courseIds)
                            ->distinct('user_id')
                            ->count('user_id');
        $avgPassRate   = $quizIds->isNotEmpty()
                            ? (int) round(QuizAttempt::whereIn('quiz_id', $quizIds)->avg('percentage') ?? 0)
                            : 0;
        $pendingCount  = Question::whereIn('course_id', $courseIds)
                            ->whereNull('answer')
                            ->count();
        $newThisMonth  = Enrollment::whereIn('course_id', $courseIds)
                            ->where('created_at', '>=', Carbon::now()->startOfMonth())
                            ->distinct('user_id')
                            ->count('user_id');

        // ── Performance trend (last 6 weeks) ─────────────────────────────────
        $performanceTrend = [];
        for ($i = 5; $i >= 0; $i--) {
            $start = Carbon::now()->startOfWeek()->subWeeks($i);
            $end   = Carbon::now()->startOfWeek()->subWeeks($i)->endOfWeek();
            $agg   = QuizAttempt::whereIn('quiz_id', $quizIds)
                        ->whereBetween('created_at', [$start, $end])
                        ->selectRaw('AVG(percentage) as avg_score, COUNT(*) as submissions')
                        ->first();
            $performanceTrend[] = [
                'name'        => 'Week ' . (6 - $i),
                'avgScore'    => (int) round($agg->avg_score ?? 0),
                'submissions' => (int) ($agg->submissions ?? 0),
            ];
        }

        // ── Course enrollment vs completion ───────────────────────────────────
        $courseStats = Course::where(function ($q) use ($user, $assignedSubIds, $assignedDept) {
                $q->where('instructor_id', $user->id);
                if (!empty($assignedSubIds) || $assignedDept) {
                    $q->orWhere(function ($q2) use ($assignedSubIds, $assignedDept) {
                        if (!empty($assignedSubIds)) $q2->whereIn('subdepartment_id', $assignedSubIds);
                        if ($assignedDept) $q2->orWhere('department', $assignedDept);
                    });
                }
            })
            ->withCount([
                'enrollments',
                'enrollments as completed_count' => fn ($q) => $q->where('status', 'completed'),
            ])
            ->get()
            ->map(fn ($c) => [
                'name'      => $c->title,
                'enrolled'  => $c->enrollments_count,
                'completed' => $c->completed_count,
            ]);

        // ── Pending evaluations (unanswered student questions) ────────────────
        $pendingEvaluations = Question::whereIn('course_id', $courseIds)
            ->whereNull('answer')
            ->with(['user:id,fullname', 'course:id,title'])
            ->orderBy('created_at', 'desc')
            ->take(10)
            ->get()
            ->map(fn ($q) => [
                'id'        => $q->id,
                'student'   => $q->user->fullname ?? 'Unknown',
                'question'  => $q->question,
                'course'    => $q->course->title ?? 'Unknown',
                'submitted' => $q->created_at->diffForHumans(),
                'type'      => 'Question',
            ]);

        // ── Recent student questions ──────────────────────────────────────────
        $recentQuestions = Question::whereIn('course_id', $courseIds)
            ->with(['user:id,fullname', 'course:id,title'])
            ->orderBy('created_at', 'desc')
            ->take(5)
            ->get()
            ->map(fn ($q) => [
                'id'       => $q->id,
                'student'  => $q->user->fullname ?? 'Unknown',
                'question' => $q->question,
                'course'   => $q->course->title ?? 'Unknown',
                'time'     => $q->created_at->diffForHumans(),
                'answered' => !is_null($q->answer),
            ]);

        return response()->json([
            'user' => [
                'id'              => $user->id,
                'name'            => $user->fullname,
                'email'           => $user->email,
                'role'            => $user->role,
                'profile_picture' => $user->profile_picture
                                        ? asset('storage/' . $user->profile_picture)
                                        : null,
            ],
            'stats' => [
                'pending_reviews'    => $pendingCount,
                'total_courses'      => $totalCourses,
                'total_students'     => $totalStudents,
                'avg_pass_rate'      => $avgPassRate,
                'new_students_month' => $newThisMonth,
            ],
            'performance_trend'   => $performanceTrend,
            'course_stats'        => $courseStats,
            'pending_evaluations' => $pendingEvaluations,
            'recent_questions'    => $recentQuestions,
        ]);
    }

    /**
     * Get a specific own course with modules.
     */
    public function show(Request $request, string $id)
    {
        $user = $request->user();

        // Fetch the course and verify instructor has rights either by ownership
        // or because the course belongs to a department/subdepartment assigned to them
        $course = Course::with(['modules.lessons', 'enrolledUsers:id,fullname,email,department,role,status'])
            ->find($id);

        if (!$course) {
            return response()->json(['message' => 'Course not found.'], 404);
        }

        $assignedSubIds = $user->subdepartments()->pluck('subdepartments.id')->toArray();
        $assignedDept = $user->department;

        $allowed = ($course->instructor_id == $user->id)
            || (!empty($assignedSubIds) && in_array($course->subdepartment_id, $assignedSubIds))
            || ($assignedDept && $course->department === $assignedDept);

        if (!$allowed) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        // Recalculate progress for each enrolled user
        foreach ($course->enrolledUsers as $eu) {
            Enrollment::recalculateProgress($eu->id, $course->id);
        }
        // Refresh to get updated pivot data
        $course->load('enrolledUsers:id,fullname,email,department,role,status');

        return response()->json($course);
    }

    /**
     * Create a new course.
     */
    public function store(Request $request)
    {
        $user = $request->user();

        try {
            $validated = $request->validate([
                'title'              => 'required|string|max:255',
                'description'        => 'nullable|string',
                'department'         => 'required|string|max:255',
                'status'             => ['nullable', Rule::in(['Active', 'Inactive', 'Draft'])],
                'start_date'         => 'nullable|date',
                'deadline'           => 'nullable|date',
                'logo'               => 'nullable|image|mimes:png,jpg,jpeg,svg|max:2048',
                'modules'            => 'nullable|array',
                'modules.*.title'    => 'nullable|string|max:255',
                'modules.*.content'  => 'nullable|file|max:102400',
            ]);

            // Handle logo upload
            $logoPath = null;
            if ($request->hasFile('logo')) {
                $logoPath = $request->file('logo')->store('course-logos', 'public');
            }

            $course = Course::create([
                'title'         => $validated['title'],
                'description'   => $validated['description'] ?? null,
                'department'    => $validated['department'],
                'instructor_id' => $user->id,
                'status'        => $validated['status'] ?? 'Active',
                'start_date'    => $validated['start_date'] ?? null,
                'deadline'      => $validated['deadline'] ?? null,
                'logo_path'     => $logoPath,
            ]);

            if (!empty($validated['modules'])) {
                foreach ($validated['modules'] as $module) {
                    if (isset($module['content']) && $module['content'] instanceof \Illuminate\Http\UploadedFile) {
                        $filePath = $module['content']->store('course-content', 'public');
                        $course->modules()->create([
                            'title'        => $module['title'] ?? 'Untitled Module',
                            'content_path' => $filePath,
                        ]);
                    }
                }
            }

            return response()->json([
                'message' => 'Course created successfully',
                'course'  => $course->load('modules'),
            ], 201);
        } catch (ValidationException $e) {
            return response()->json(['message' => 'Validation failed', 'errors' => $e->errors()], 422);
        } catch (Exception $e) {
            return response()->json(['message' => 'An error occurred: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Update own course.
     */
    public function update(Request $request, string $id)
    {
        $user = $request->user();

        $course = Course::findOrFail($id);

        $assignedSubIds = $user->subdepartments()->pluck('subdepartments.id')->toArray();
        $assignedDept = $user->department;

        $allowed = ($course->instructor_id == $user->id)
            || (!empty($assignedSubIds) && in_array($course->subdepartment_id, $assignedSubIds))
            || ($assignedDept && $course->department === $assignedDept);

        if (!$allowed) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        try {
            $validated = $request->validate([
                'title'             => 'sometimes|string|max:255',
                'description'       => 'nullable|string',
                'department'        => 'sometimes|string|max:255',
                'status'            => ['sometimes', Rule::in(['Active', 'Inactive', 'Draft'])],
                'start_date'        => 'nullable|date',
                'deadline'          => 'nullable|date',
                'logo'              => 'nullable|image|mimes:png,jpg,jpeg,svg|max:2048',
                'remove_logo'       => 'nullable|boolean',
                'modules'           => 'nullable|array',
                'modules.*.title'   => 'nullable|string|max:255',
                'modules.*.content' => 'nullable|file|max:102400',
            ]);

            // Handle logo
            if ($request->hasFile('logo')) {
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

            $course->update(array_filter($validated, fn ($k) =>
                in_array($k, ['title', 'description', 'department', 'status', 'start_date', 'deadline', 'logo_path']),
                ARRAY_FILTER_USE_KEY
            ));

            if (!empty($validated['modules'])) {
                foreach ($validated['modules'] as $module) {
                    if (isset($module['content']) && $module['content'] instanceof \Illuminate\Http\UploadedFile) {
                        $filePath = $module['content']->store('course-content', 'public');
                        $course->modules()->create([
                            'title'        => $module['title'] ?? 'Untitled Module',
                            'content_path' => $filePath,
                        ]);
                    }
                }
            }

            return response()->json([
                'message' => 'Course updated successfully',
                'course'  => $course->load('modules'),
            ]);
        } catch (ValidationException $e) {
            return response()->json(['message' => 'Validation failed', 'errors' => $e->errors()], 422);
        } catch (Exception $e) {
            return response()->json(['message' => 'An error occurred: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Delete own course.
     */
    public function destroy(Request $request, string $id)
    {
        $user = $request->user();

        $course = Course::findOrFail($id);

        $assignedSubIds = $user->subdepartments()->pluck('subdepartments.id')->toArray();
        $assignedDept = $user->department;

        $allowed = ($course->instructor_id == $user->id)
            || (!empty($assignedSubIds) && in_array($course->subdepartment_id, $assignedSubIds))
            || ($assignedDept && $course->department === $assignedDept);

        if (!$allowed) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $course->delete();

        return response()->json(['message' => 'Course deleted successfully']);
    }

    /**
     * Add a module to an own course.
     */
    public function addModule(Request $request, string $id)
    {
        $user = $request->user();

        $course = Course::findOrFail($id);

        $assignedSubIds = $user->subdepartments()->pluck('subdepartments.id')->toArray();
        $assignedDept = $user->department;

        $allowed = ($course->instructor_id == $user->id)
            || (!empty($assignedSubIds) && in_array($course->subdepartment_id, $assignedSubIds))
            || ($assignedDept && $course->department === $assignedDept);

        if (!$allowed) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $request->validate([
            'title'       => 'required|string|max:255',
            'description' => 'nullable|string',
            'content'     => 'nullable|file|max:102400',
        ]);

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
        try {
                Log::info('Instructor::addModule created module', [
                'user_id' => $user->id,
                'course_id' => $course->id,
                'module_id' => $module->id,
                'module_title' => $module->title,
            ]);
        } catch (\Exception $e) {
            // ignore
        }

        return response()->json(['message' => 'Module added successfully', 'module' => $module], 201);
    }

    /**
     * Delete a module from an own course.
     */
    public function deleteModule(Request $request, string $courseId, int $moduleId)
    {
        $user = $request->user();

        $course = Course::findOrFail($courseId);

        $assignedSubIds = $user->subdepartments()->pluck('subdepartments.id')->toArray();
        $assignedDept = $user->department;

        $allowed = ($course->instructor_id === $user->id)
            || (!empty($assignedSubIds) && in_array($course->subdepartment_id, $assignedSubIds))
            || ($assignedDept && $course->department === $assignedDept);

        if (!$allowed) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $module = $course->modules()->findOrFail($moduleId);
        $module->delete();

        return response()->json(['message' => 'Module deleted successfully']);
    }

    /**
     * Add a lesson to a module (owned by this instructor's course).
     */
    public function addLesson(Request $request, int $moduleId)
    {
        $user = $request->user();
        $module = Module::with('course')->findOrFail($moduleId);

        $assignedSubIds = $user->subdepartments()->pluck('subdepartments.id')->toArray();
        $assignedDept = $user->department;

        $allowed = ($module->course->instructor_id == $user->id)
            || (!empty($assignedSubIds) && in_array($module->course->subdepartment_id, $assignedSubIds))
            || ($assignedDept && $module->course->department === $assignedDept);

        if (!$allowed) {
            abort(403, 'Forbidden.');
        }

        $request->validate([
            'title'        => 'required|string|max:255',
            'text_content' => 'nullable|string',
            'content'      => 'nullable|file|max:102400',
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

        // If an external content URL is provided (e.g., YouTube embed), store it directly
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
     * Delete a lesson from a module (owned by this instructor's course).
     */
    public function deleteLesson(Request $request, int $moduleId, int $lessonId)
    {
        $user = $request->user();
        $module = Module::with('course')->findOrFail($moduleId);

        $assignedSubIds = $user->subdepartments()->pluck('subdepartments.id')->toArray();
        $assignedDept = $user->department;

        $allowed = ($module->course->instructor_id == $user->id)
            || (!empty($assignedSubIds) && in_array($module->course->subdepartment_id, $assignedSubIds))
            || ($assignedDept && $module->course->department === $assignedDept);

        if (!$allowed) {
            abort(403, 'Forbidden.');
        }

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
        $user = $request->user();
        $course = Course::findOrFail($courseId);
        $assignedSubIds = $user->subdepartments()->pluck('subdepartments.id')->toArray();
        $assignedDept = $user->department;

        $allowed = ($course->instructor_id == $user->id)
            || (!empty($assignedSubIds) && in_array($course->subdepartment_id, $assignedSubIds))
            || ($assignedDept && $course->department === $assignedDept);

        if (!$allowed) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

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
        $user = $request->user();
        $module = Module::with('course')->findOrFail($moduleId);

        if ($module->course->instructor_id !== $user->id) {
            abort(403, 'Forbidden.');
        }

        $request->validate([
            'title'        => 'sometimes|string|max:255',
            'text_content' => 'nullable|string',
            'content'      => 'nullable|file|max:102400',
        ]);

        $lesson = $module->lessons()->findOrFail($lessonId);

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
        $user = $request->user();
        $course = Course::findOrFail($courseId);

        $assignedSubIds = $user->subdepartments()->pluck('subdepartments.id')->toArray();
        $assignedDept = $user->department;

        $allowed = ($course->instructor_id == $user->id)
            || (!empty($assignedSubIds) && in_array($course->subdepartment_id, $assignedSubIds))
            || ($assignedDept && $course->department === $assignedDept);

        if (!$allowed) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $request->validate([
            'order'   => 'required|array',
            'order.*' => 'integer|exists:modules,id',
        ]);

        foreach ($request->input('order') as $index => $moduleId) {
            $course->modules()->where('id', $moduleId)->update(['order' => $index + 1]);
        }

        return response()->json(['message' => 'Modules reordered']);
    }

    // ─── ENROLLMENT MANAGEMENT ──────────────────────────────────────────────

    /**
     * List active employees (for enrollment dropdown).
     */
    public function listUsers()
    {
        $users = User::where('status', 'Active')
            ->whereIn('role', ['Employee'])
            ->select('id', 'fullname', 'email', 'role', 'department', 'status')
            ->orderBy('fullname')
            ->get();

        return response()->json($users);
    }

    /**
     * List all enrolled users for an instructor's own course.
     */
    public function enrollments(Request $request, string $id)
    {
        $user = $request->user();
        $course = Course::findOrFail($id);

        $assignedSubIds = $user->subdepartments()->pluck('subdepartments.id')->toArray();
        $assignedDept = $user->department;

        $allowed = ($course->instructor_id == $user->id)
            || (!empty($assignedSubIds) && in_array($course->subdepartment_id, $assignedSubIds))
            || ($assignedDept && $course->department === $assignedDept);

        if (!$allowed) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        // Recalculate each user's progress
        foreach ($course->enrollments as $enrollment) {
            Enrollment::recalculateProgress($enrollment->user_id, $course->id);
        }

        $users = $course->enrolledUsers()
            ->select('users.id', 'users.fullname', 'users.email', 'users.department', 'users.role', 'users.status')
            ->get()
            ->map(function ($user) {
                return [
                    'id'                => $user->id,
                    'fullname'          => $user->fullname,
                    'email'             => $user->email,
                    'department'        => $user->department,
                    'role'              => $user->role,
                    'status'            => $user->status,
                    'enrolled_at'       => $user->pivot->enrolled_at,
                    'progress'          => $user->pivot->progress,
                    'enrollment_status' => $user->pivot->status,
                    'locked'            => $user->pivot->locked ?? false,
                ];
            });

        return response()->json($users);
    }

    /**
     * Lock an employee's enrollment to prevent access.
     */
    public function lockEnrollment(Request $request, string $courseId, int $userId)
    {
        $user = $request->user();
        $course = Course::findOrFail($courseId);

        $assignedSubIds = $user->subdepartments()->pluck('subdepartments.id')->toArray();
        $assignedDept = $user->department;

        $allowed = ($course->instructor_id === $user->id)
            || (!empty($assignedSubIds) && in_array($course->subdepartment_id, $assignedSubIds))
            || ($assignedDept && $course->department === $assignedDept);

        if (!$allowed) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        /** @var \App\Models\CourseEnrollment|null $enrollment */
        $enrollment = $course->enrollments()->where('user_id', $userId)->first();
        if (!$enrollment) {
            return response()->json(['message' => 'Enrollment not found'], 404);
        }

        $enrollment->update(['locked' => true]);

        return response()->json(['message' => 'Enrollment locked']);
    }

    /**
     * Unlock an employee's enrollment.
     */
    public function unlockEnrollment(Request $request, string $courseId, int $userId)
    {
        $user = $request->user();
        $course = Course::findOrFail($courseId);

        $assignedSubIds = $user->subdepartments()->pluck('subdepartments.id')->toArray();
        $assignedDept = $user->department;

        $allowed = ($course->instructor_id === $user->id)
            || (!empty($assignedSubIds) && in_array($course->subdepartment_id, $assignedSubIds))
            || ($assignedDept && $course->department === $assignedDept);

        if (!$allowed) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        /** @var \App\Models\CourseEnrollment|null $enrollment */
        $enrollment = $course->enrollments()->where('user_id', $userId)->first();
        if (!$enrollment) {
            return response()->json(['message' => 'Enrollment not found'], 404);
        }

        $enrollment->update(['locked' => false]);
            // Broadcast to the user so their UI can refresh in realtime
            try {
                event(new EnrollmentUnlocked($enrollment->user_id, $course->id));
            } catch (\Throwable $e) {
                // Don't fail the API if broadcasting isn't configured
                Log::warning('Failed to broadcast EnrollmentUnlocked: ' . $e->getMessage());
            }

        return response()->json(['message' => 'Enrollment unlocked']);
    }

    /**
     * Unlock a specific module for a given user.
     */
    public function unlockModule(Request $request, string $courseId, string $moduleId, int $userId)
    {
        $user = $request->user();
        $course = Course::findOrFail($courseId);

        $assignedSubIds = $user->subdepartments()->pluck('subdepartments.id')->toArray();
        $assignedDept = $user->department;

        $allowed = ($course->instructor_id === $user->id)
            || (!empty($assignedSubIds) && in_array($course->subdepartment_id, $assignedSubIds))
            || ($assignedDept && $course->department === $assignedDept);

        if (!$allowed) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $module = Module::where('course_id', $course->id)->where('id', $moduleId)->first();
        if (!$module) return response()->json(['message' => 'Module not found'], 404);

        // Upsert pivot
        DB::table('module_user')->updateOrInsert(
            ['module_id' => $module->id, 'user_id' => $userId],
            ['unlocked' => true, 'unlocked_at' => now(), 'updated_at' => now(), 'created_at' => now()]
        );

        try {
            event(new ModuleUnlocked($userId, $course->id, $module->id));
        } catch (\Throwable $e) {
            Log::warning('Failed to broadcast ModuleUnlocked: ' . $e->getMessage());
        }

        return response()->json(['message' => 'Module unlocked for user']);
    }

    /**
     * Lock a specific module for a given user.
     */
    public function lockModule(Request $request, string $courseId, string $moduleId, int $userId)
    {
        $user = $request->user();
        $course = Course::findOrFail($courseId);

        $assignedSubIds = $user->subdepartments()->pluck('subdepartments.id')->toArray();
        $assignedDept = $user->department;

        $allowed = ($course->instructor_id === $user->id)
            || (!empty($assignedSubIds) && in_array($course->subdepartment_id, $assignedSubIds))
            || ($assignedDept && $course->department === $assignedDept);

        if (!$allowed) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $module = Module::where('course_id', $course->id)->where('id', $moduleId)->first();
        if (!$module) return response()->json(['message' => 'Module not found'], 404);

        DB::table('module_user')->updateOrInsert(
            ['module_id' => $module->id, 'user_id' => $userId],
            ['unlocked' => false, 'unlocked_at' => null, 'updated_at' => now(), 'created_at' => now()]
        );

        return response()->json(['message' => 'Module locked for user']);
    }

    /**
     * Enroll a user into an instructor's own course.
     */
    public function enroll(Request $request, string $id)
    {
        $request->validate([
            'user_id' => 'required|exists:users,id',
        ]);

        $user = $request->user();
        $course = Course::findOrFail($id);

        $assignedSubIds = $user->subdepartments()->pluck('subdepartments.id')->toArray();
        $assignedDept = $user->department;

        $allowed = ($course->instructor_id === $user->id)
            || (!empty($assignedSubIds) && in_array($course->subdepartment_id, $assignedSubIds))
            || ($assignedDept && $course->department === $assignedDept);

        if (!$allowed) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($course->enrollments()->where('user_id', $request->user_id)->exists()) {
            return response()->json(['message' => 'User is already enrolled in this course'], 409);
        }

        $course->enrollments()->create([
            'user_id'     => $request->user_id,
            'progress'    => 0,
            'enrolled_at' => now(),
        ]);

        $user = User::select('id', 'fullname', 'email', 'department', 'role', 'status')
            ->findOrFail($request->user_id);

        return response()->json([
            'message' => 'User enrolled successfully',
            'user'    => $user,
        ], 201);
    }

    /**
     * Remove an enrollment from an instructor's own course.
     */
    public function unenroll(Request $request, string $courseId, int $userId)
    {
        $user = $request->user();
        $course = Course::findOrFail($courseId);

        $assignedSubIds = $user->subdepartments()->pluck('subdepartments.id')->toArray();
        $assignedDept = $user->department;

        $allowed = ($course->instructor_id === $user->id)
            || (!empty($assignedSubIds) && in_array($course->subdepartment_id, $assignedSubIds))
            || ($assignedDept && $course->department === $assignedDept);

        if (!$allowed) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $deleted = $course->enrollments()->where('user_id', $userId)->delete();

        if (!$deleted) {
            return response()->json(['message' => 'Enrollment not found'], 404);
        }

        return response()->json(['message' => 'User unenrolled successfully']);
    }
}
