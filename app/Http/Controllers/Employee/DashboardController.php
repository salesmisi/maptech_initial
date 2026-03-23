<?php

namespace App\Http\Controllers\Employee;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\CourseEnrollment;
use App\Models\Enrollment;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use App\Models\Subdepartment;
use Illuminate\Http\Request;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class DashboardController extends Controller
{
    /**
     * Resolve the department name for a user via their subdepartment relationship.
     * Falls back to the raw user.department string if no subdepartment is set.
     */
    private function resolveUserDepartment($user): ?string
    {
        if ($user->subdepartment_id) {
            $sub = Subdepartment::with('department')->find($user->subdepartment_id);
            if ($sub && $sub->department) {
                return $sub->department->name;
            }
        }
        return $user->department;
    }

    /**
     * Return a map of course_id => true for courses where at least one
     * module is currently manually unlocked for the given user.
     */
    private function getManuallyUnlockedCourseIdsForUser(int $userId, $courseIds): array
    {
        $courseIds = collect($courseIds)->filter()->unique()->values();
        if ($courseIds->isEmpty()) {
            return [];
        }

        $rows = DB::table('module_user')
            ->join('modules', 'module_user.module_id', '=', 'modules.id')
            ->where('module_user.user_id', $userId)
            ->whereIn('modules.course_id', $courseIds)
            ->where('module_user.unlocked', true)
            ->where(function ($q) {
                $q->whereNull('module_user.unlocked_until')
                  ->orWhere('module_user.unlocked_until', '>', now());
            })
            ->pluck('modules.course_id')
            ->map(fn($id) => (string) $id)
            ->toArray();

        // flip to use as a quick lookup set
        return array_flip($rows);
    }

    /**
     * Build a course query scoped to the employee's department/subdepartment.
     * Shows courses whose subdepartment belongs to the same department,
     * plus department-wide courses (subdepartment_id IS NULL, department name matches).
     */
    private function scopeCoursesForUser($query, $user)
    {
        $departmentName = $this->resolveUserDepartment($user);

        // Get all subdepartment IDs in the user's department
        $deptSubIds = collect();
        if ($user->subdepartment_id) {
            $sub = Subdepartment::find($user->subdepartment_id);
            if ($sub) {
                $deptSubIds = Subdepartment::where('department_id', $sub->department_id)->pluck('id');
            }
        }

        return $query->where(function ($q) use ($user, $departmentName, $deptSubIds) {
            if ($user->subdepartment_id && $deptSubIds->isNotEmpty()) {
                // Courses assigned to the user's specific subdepartment
                $q->where('subdepartment_id', $user->subdepartment_id);

                // OR department-wide courses (no subdepartment, matching department name)
                $q->orWhere(function ($inner) use ($departmentName) {
                    $inner->whereNull('subdepartment_id')
                          ->where('department', $departmentName);
                });
            } else {
                // User has no subdepartment — match by department name only
                $q->where('department', $departmentName);
            }
        });
    }

    /**
     * Resolve enrollment status for a given enrollment row + course.
     */
    private function resolveStatus(Enrollment $enrollment, Course $course): string
    {
        if ($enrollment->progress >= 100) {
            return 'Completed';
        }
        if ($course->deadline && Carbon::now()->isAfter($course->deadline)) {
            return 'Unfinished';
        }
        if ($enrollment->progress > 0) {
            return 'In Progress';
        }
        return 'Not Started';
    }

    /**
     * Dashboard summary.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        $courses = Course::active()
            ->where(function ($q) use ($user) {
                $this->scopeCoursesForUser($q, $user);
            })
            ->with('instructor:id,fullname,email', 'modules:id,title,content_path,course_id')
            ->orderBy('created_at', 'desc')
            ->get();

        $manuallyUnlockedCourseIds = $this->getManuallyUnlockedCourseIdsForUser(
            $user->id,
            $courses->pluck('id')
        );

        // Attach enrollment progress to each course
        $enrollments = CourseEnrollment::where('user_id', $user->id)
            ->whereIn('course_id', $courses->pluck('id'))
            ->get()
            ->keyBy('course_id');

        $coursesWithProgress = $courses->map(function (Course $course) use ($enrollments, $manuallyUnlockedCourseIds) {
            $enrollment = $enrollments->get($course->id);
            $locked     = (bool) ($enrollment->locked ?? false);

            // If at least one module is manually unlocked for this user
            // on this course, treat it as unlocked on the dashboard.
            if ($locked && isset($manuallyUnlockedCourseIds[$course->id])) {
                $locked = false;
            }

            return array_merge($course->toArray(), [
                'progress'       => $enrollment?->progress ?? 0,
                'enroll_status'  => $enrollment?->status ?? null,
                'last_activity'  => $enrollment?->updated_at?->toISOString() ?? null,
                'locked'         => $locked,
                'has_manual_unlock' => isset($manuallyUnlockedCourseIds[$course->id]),
            ]);
        });

        return response()->json([
            'user'          => [
                'id'         => $user->id,
                'name'       => $user->fullname,
                'email'      => $user->email,
                'department' => $user->department,
            ],
            'courses'       => $coursesWithProgress,
            'total_courses' => $courses->count(),
        ]);
    }

    /**
     * ALL active courses in the employee's department,
     * annotated with the current user's enrollment status.
     * Used by the global top search bar.
     */
    public function allCourses(Request $request)
    {
        $user = $request->user();

        $courses = Course::active()
            ->with('instructor:id,fullname,email', 'modules:id,title,course_id')
            ->where(function ($q) use ($user) {
                $this->scopeCoursesForUser($q, $user);
            })
            ->orderBy('title')
            ->get();

        $manuallyUnlockedCourseIds = $this->getManuallyUnlockedCourseIdsForUser(
            $user->id,
            $courses->pluck('id')
        );

        // Index enrollments by course_id for O(1) lookup
        $enrollments = Enrollment::where('user_id', $user->id)
            ->whereIn('course_id', $courses->pluck('id'))
            ->get()
            ->keyBy('course_id');

        $result = $courses->map(function (Course $course) use ($enrollments, $manuallyUnlockedCourseIds) {
            $enrollment = $enrollments->get($course->id);
            $locked     = (bool) ($enrollment->locked ?? false);

            if ($locked && isset($manuallyUnlockedCourseIds[$course->id])) {
                $locked = false;
            }

            return [
                'id'            => $course->id,
                'title'         => $course->title,
                'description'   => $course->description,
                'department'    => $course->department,
                'status'        => $course->status,
                'deadline'      => $course->deadline?->toISOString(),
                'modules_count' => $course->modules->count(),
                'instructor'    => $course->instructor?->fullname,
                'is_enrolled'   => (bool) $enrollment,
                'my_progress'   => $enrollment?->progress ?? 0,
                'my_status'     => $enrollment ? $this->resolveStatus($enrollment, $course) : null,
                'locked'        => $locked,
                'has_manual_unlock' => isset($manuallyUnlockedCourseIds[$course->id]),
            ];
        });

        return response()->json($result);
    }

    /**
     * Only courses the employee is enrolled in (My Courses list).
     */
    public function courses(Request $request)
    {
        $user = $request->user();

        $enrollments = Enrollment::where('user_id', $user->id)
            ->with(['course' => function ($q) use ($user) {
                $this->scopeCoursesForUser($q, $user);
                $q->with('instructor:id,fullname,email', 'modules:id,title,course_id');
            }])
            ->get()
            ->filter(fn ($e) => $e->course !== null);

        $courseIds = $enrollments->pluck('course_id');
        $manuallyUnlockedCourseIds = $this->getManuallyUnlockedCourseIdsForUser($user->id, $courseIds);

        // Recalculate progress for all enrollments from quiz attempts
        /** @var \App\Models\Enrollment $enrollment */
        foreach ($enrollments as $enrollment) {
            Enrollment::recalculateProgress($user->id, $enrollment->course_id);
            $enrollment->refresh();
        }

        $result = $enrollments->map(function (Enrollment $enrollment) use ($manuallyUnlockedCourseIds) {
            $course = $enrollment->course;
            $locked = (bool) ($enrollment->locked ?? false);

            // If instructor has manually unlocked any module in this course
            // for this employee (including department-wide unlocks), treat
            // the course as unlocked in the "My Courses" list so it can be opened.
            if ($locked && isset($manuallyUnlockedCourseIds[$course->id])) {
                $locked = false;
            }

            return [
                'id'           => $course->id,
                'title'        => $course->title,
                'description'  => $course->description,
                'department'   => $course->department,
                'deadline'     => $course->deadline?->toISOString(),
                'modules_count'=> $course->modules->count(),
                'instructor'   => $course->instructor?->fullname,
                'progress'     => $enrollment->progress,
                'status'       => $this->resolveStatus($enrollment, $course),
                'enrolled_at'  => $enrollment->enrolled_at,
                'locked'       => $locked,
                'has_manual_unlock' => isset($manuallyUnlockedCourseIds[$course->id]),
            ];
        })->values();

        return response()->json($result);
    }

    /**
     * Self-enroll the current user into a course.
     */
    public function enroll(Request $request, string $id)
    {
        $user = $request->user();

        $course = Course::active()->find($id);
        if (!$course) {
            return response()->json(['message' => 'Course not found or not available.'], 404);
        }

        // Restrict enrollment to courses in the employee's department/subdepartment
        $departmentName = $this->resolveUserDepartment($user);
        $courseBelongsToUser = false;

        if ($user->subdepartment_id && $course->subdepartment_id) {
            // Both have subdepartment — must match
            $courseBelongsToUser = ($course->subdepartment_id === $user->subdepartment_id);
        } elseif ($user->subdepartment_id && !$course->subdepartment_id) {
            // Course is department-wide — check department name
            $courseBelongsToUser = ($course->department === $departmentName);
        } else {
            // User has no subdepartment — match by department
            $courseBelongsToUser = ($course->department === $departmentName);
        }

        if (!$courseBelongsToUser) {
            return response()->json(['message' => 'This course is not available for your department.'], 403);
        }

        if (Enrollment::where('user_id', $user->id)->where('course_id', $id)->exists()) {
            return response()->json(['message' => 'You are already enrolled in this course.'], 409);
        }

        Enrollment::create([
            'user_id'     => $user->id,
            'course_id'   => $id,
            'progress'    => 0,
            'enrolled_at' => now(),
        ]);

        return response()->json(['message' => 'Enrolled successfully.'], 201);
    }

    /**
     * Get a specific course with module quiz/unlock status for the employee.
     */
    public function showCourse(Request $request, string $id)
    {
        $user = $request->user();

        // Recalculate progress from quiz attempts (fixes stale data)
        Enrollment::recalculateProgress($user->id, $id);

        $course = Course::active()
            ->with([
                'instructor:id,fullname,email',
                'modules' => fn($q) => $q->with('lessons')->orderBy('order')->orderBy('id'),
            ])
            ->find($id);

        if (!$course) {
            return response()->json(['message' => 'Course not found or not accessible.'], 404);
        }

        // Load module IDs for this course early (used below)
        $moduleIds      = $course->modules->pluck('id');

        // Load manual module unlocks for this user (if any) early so we can
        // allow access to specific modules even when the instructor has
        // locked the overall enrollment for this user.
        $manualUnlockedModuleIds = DB::table('module_user')
            ->where('user_id', $user->id)
            ->whereIn('module_id', $moduleIds)
            ->where('unlocked', true)
            ->where(function ($q) {
                $q->whereNull('unlocked_until')
                  ->orWhere('unlocked_until', '>', now());
            })
            ->pluck('module_id')
            ->map(fn($id) => (string)$id)
            ->toArray();

        // Prevent access if the instructor locked this enrollment and there
        // are no manually-unlocked modules for this user. If some modules
        // were manually unlocked, allow access so the employee can open them.
        $enrollmentRecord = Enrollment::where('user_id', $user->id)
            ->where('course_id', $id)
            ->first();
        if ($enrollmentRecord && ($enrollmentRecord->locked ?? false)) {
            $enrollmentUnlockedUntil = $enrollmentRecord->unlocked_until ?? null;
            $enrollmentCurrentlyUnlocked = $enrollmentUnlockedUntil && \Carbon\Carbon::parse($enrollmentUnlockedUntil)->isFuture();
            if (empty($manualUnlockedModuleIds) && !$enrollmentCurrentlyUnlocked) {
                return response()->json(['message' => 'This course has been locked by the instructor.'], 403);
            }
            // otherwise, continue and show the course with only the unlocked modules available
        }

        // Load quizzes for every module in this course (keyed by module_id)
        $quizByModule   = Quiz::whereIn('module_id', $moduleIds)
            ->withCount('questions')
            ->get()
            ->keyBy('module_id');

        // Load all quiz_ids
        $quizIds = $quizByModule->pluck('id');

        // Find which quizzes this employee has already passed
        $passedQuizIds = QuizAttempt::where('user_id', $user->id)
            ->whereIn('quiz_id', $quizIds)
            ->where('passed', true)
            ->pluck('quiz_id')
            ->flip(); // flip to use as a set for O(1) lookup

        // manual unlocks were loaded earlier

        // Best attempt per quiz (for the UI to show last score)
        $bestAttempts = QuizAttempt::where('user_id', $user->id)
            ->whereIn('quiz_id', $quizIds)
            ->orderByDesc('percentage')
            ->get()
            ->unique('quiz_id')
            ->keyBy('quiz_id');

        // Build module list with unlock logic:
        //   Module 1 is always unlocked.
        //   Module N is unlocked if module N-1 has no quiz OR if the employee passed module N-1's quiz.
        $previousUnlocked = true; // tracks whether the previous stage is cleared

        $modules = $course->modules->map(function ($mod) use (
            &$previousUnlocked,
            $quizByModule,
            $passedQuizIds,
            $bestAttempts,
            $manualUnlockedModuleIds
        ) {
            $isUnlocked = $previousUnlocked;

            // If instructor manually unlocked this module for the user, ensure access
            if (in_array((string) $mod->id, $manualUnlockedModuleIds, true)) {
                $isUnlocked = true;
                // Do not alter $previousUnlocked (manual unlock doesn't change sequence rules)
            }

            $quiz = $quizByModule->get($mod->id);

            if ($quiz) {
                $hasPassed       = isset($passedQuizIds[$quiz->id]);
                $previousUnlocked = $hasPassed; // next module requires passing this quiz
                $best             = $bestAttempts->get($quiz->id);

                $quizData = [
                    'id'              => $quiz->id,
                    'title'           => $quiz->title,
                    'description'     => $quiz->description,
                    'pass_percentage' => $quiz->pass_percentage,
                    'question_count'  => $quiz->questions_count,
                    'has_passed'      => $hasPassed,
                    'best_attempt'    => $best ? [
                        'score'           => $best->score,
                        'total_questions' => $best->total_questions,
                        'percentage'      => (float) $best->percentage,
                        'passed'          => $best->passed,
                        'created_at'      => $best->created_at,
                    ] : null,
                ];
            } else {
                // No quiz on this module — it doesn't block the next module
                // previousUnlocked stays as-is (carries the last blocking state forward)
                $quizData = null;
            }

            return [
                'id'          => $mod->id,
                'title'       => $mod->title,
                'content_path'=> $mod->content_path,
                'content_url' => $mod->content_url,
                'file_type'   => $mod->file_type,
                'order'       => $mod->order,
                'created_at'  => $mod->created_at,
                'lessons'     => $mod->lessons->map(fn($l) => [
                    'id'           => $l->id,
                    'title'        => $l->title,
                    'text_content' => $l->text_content,
                    'content_path' => $l->content_path,
                    'content_url'  => $l->content_url,
                    'file_type'    => $l->file_type,
                    'order'        => $l->order,
                ]),
                'quiz'        => $quizData,
                'is_unlocked' => $isUnlocked,
            ];
        });

        return response()->json([
            'id'          => $course->id,
            'title'       => $course->title,
            'description' => $course->description,
            'department'  => $course->department,
            'status'      => $course->status,
            'deadline'    => $course->deadline?->toISOString(),
            'instructor'  => $course->instructor ? [
                'id'       => $course->instructor->id,
                'fullName' => $course->instructor->fullname,
                'email'    => $course->instructor->email,
            ] : null,
            'modules'     => $modules->values(),
        ]);
    }

    /**
     * Employee learning progress summary.
     */
    public function progress(Request $request)
    {
        $user = $request->user();

        // Enrolled courses with their statuses
        $enrollments = Enrollment::where('user_id', $user->id)
            ->with('course:id,title')
            ->get();

        // Course status counts
        $completed  = 0;
        $inProgress = 0;
        $notStarted = 0;

        /** @var \App\Models\Enrollment $enrollment */
        foreach ($enrollments as $enrollment) {
            if (!$enrollment->course) continue;
            $status = $this->resolveStatus($enrollment, $enrollment->course);
            if ($status === 'Completed') $completed++;
            elseif ($status === 'In Progress' || $status === 'Unfinished') $inProgress++;
            else $notStarted++;
        }

        // Quiz attempts
        $attempts = QuizAttempt::where('user_id', $user->id)
            ->with('quiz:id,title,module_id')
            ->orderByDesc('created_at')
            ->get();

        $avgScore = $attempts->count() > 0
            ? round($attempts->avg('percentage'), 1)
            : 0;

        // Modules completed: count distinct modules where user has a passing attempt
        $modulesCompleted = $attempts->where('passed', true)
            ->pluck('quiz.module_id')
            ->filter()
            ->unique()
            ->count();

        // Total learning time estimate based on completed modules (approx 30 min each)
        $totalMinutes = $modulesCompleted * 30;
        $hours = intdiv($totalMinutes, 60);
        $mins  = $totalMinutes % 60;
        $learningTime = $hours > 0 ? "{$hours}h {$mins}m" : "{$mins}m";

        // Weekly activity (last 7 days of quiz attempts)
        $weekDays = collect();
        for ($i = 6; $i >= 0; $i--) {
            $day = Carbon::now()->subDays($i);
            $weekDays->push([
                'name'  => $day->format('D'),
                'count' => $attempts->filter(fn ($a) => $a->created_at->isSameDay($day))->count(),
            ]);
        }

        // Quiz history (best attempt per quiz)
        $quizHistory = $attempts->groupBy('quiz_id')->map(function ($group) {
            $best = $group->sortByDesc('percentage')->first();
            return [
                'name'  => $best->quiz?->title ?? 'Quiz',
                'score' => round((float) $best->percentage),
                'date'  => $best->created_at->toDateString(),
            ];
        })->values()->take(10);

        return response()->json([
            'summary' => [
                'total_learning_time' => $learningTime,
                'avg_quiz_score'      => $avgScore,
                'modules_completed'   => $modulesCompleted,
            ],
            'course_status'   => [
                ['name' => 'Completed',   'value' => $completed],
                ['name' => 'In Progress', 'value' => $inProgress],
                ['name' => 'Not Started', 'value' => $notStarted],
            ],
            'weekly_activity' => $weekDays->toArray(),
            'quiz_history'    => $quizHistory->toArray(),
        ]);
    }

    /**
     * Return quizzes with upcoming course deadlines that the user hasn't passed yet.
     * Query param `hours` controls the reminder window (default 48 hours).
     */
    public function quizReminders(Request $request)
    {
        $user = $request->user();
        $hours = (int) ($request->query('hours') ?? 48);
        $now = Carbon::now();
        $until = $now->copy()->addHours($hours);

        // Courses in the user's department/subdepartment whose deadline is within the window
        $courses = Course::active()
            ->whereBetween('deadline', [$now, $until])
            ->where(function ($q) use ($user) {
                $this->scopeCoursesForUser($q, $user);
            })
            ->with('modules')
            ->get();

        if ($courses->isEmpty()) {
            return response()->json([]);
        }

        // Collect module ids
        $moduleIds = $courses->flatMap(fn($c) => $c->modules->pluck('id'))->unique()->values();

        if ($moduleIds->isEmpty()) {
            return response()->json([]);
        }

        // Find quizzes in these modules
        $quizzes = Quiz::whereIn('module_id', $moduleIds)
            ->with(['module:id,title', 'course:id,title,deadline'])
            ->get();

        if ($quizzes->isEmpty()) {
            return response()->json([]);
        }

        // Quizzes the user already passed
        $passed = QuizAttempt::where('user_id', $user->id)->where('passed', true)->pluck('quiz_id')->toArray();

        $reminders = $quizzes->filter(fn($q) => !in_array($q->id, $passed))->map(function ($q) {
            return [
                'id' => $q->id,
                'title' => $q->title,
                'module_title' => $q->module?->title,
                'course_title' => $q->course?->title,
                'deadline' => $q->course?->deadline?->toISOString(),
                'type' => 'quiz',
            ];
        })->values();

        return response()->json($reminders);
    }
}
