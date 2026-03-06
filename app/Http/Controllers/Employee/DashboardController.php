<?php

namespace App\Http\Controllers\Employee;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\CourseEnrollment;
use App\Models\Lesson;
use App\Models\Module;
use App\Models\Notification;
use App\Models\QuizAttempt;
use Carbon\Carbon;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    /**
     * Get employee dashboard with department-filtered courses.
     *
     * The middleware ensures only the employee's department courses are accessible.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $department = $user->department;

        // Get courses for employee's department only
        $courses = Course::forDepartment($department)
            ->active()
            ->with('instructor:id,fullName,email')
            ->with(['modules' => function ($q) {
                $q->orderBy('order');
            }, 'modules.lessons' => function ($q) {
                $q->where('status', 'Published')->orderBy('order');
            }])
            ->orderBy('created_at', 'desc')
            ->get();

        // Attach enrollment progress to each course
        $enrollments = CourseEnrollment::where('user_id', $user->id)
            ->whereIn('course_id', $courses->pluck('id'))
            ->get()
            ->keyBy('course_id');

        $coursesWithProgress = $courses->map(function ($course) use ($enrollments) {
            $enrollment = $enrollments->get($course->id);
            return array_merge($course->toArray(), [
                'progress'       => $enrollment?->progress ?? 0,
                'enroll_status'  => $enrollment?->status ?? null,
                'last_activity'  => $enrollment?->updated_at?->toISOString() ?? null,
            ]);
        });

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->fullName,
                'email' => $user->email,
                'department' => $user->department,
            ],
            'courses' => $coursesWithProgress,
            'total_courses' => $courses->count(),
        ]);
    }

    /**
     * Get employee's available courses filtered by department.
     * Accepts optional ?department= query parameter to browse other departments.
     */
    public function courses(Request $request)
    {
        $user = $request->user();
        $department = $request->query('department', $user->department);

        $courses = Course::forDepartment($department)
            ->active()
            ->with('instructor:id,fullName,email')
            ->with(['modules' => function ($q) {
                $q->orderBy('order');
            }, 'modules.lessons' => function ($q) {
                $q->where('status', 'Published')->orderBy('order');
            }])
            ->orderBy('title')
            ->get();

        return response()->json($courses);
    }

    /**
     * Get a specific course (only if it belongs to employee's department).
     */
    public function showCourse(Request $request, string $id)
    {
        $user = $request->user();
        $department = $user->department;

        $course = Course::forDepartment($department)
            ->with('instructor:id,fullName,email')
            ->with(['modules' => function ($q) {
                $q->orderBy('order');
            }, 'modules.lessons' => function ($q) {
                $q->where('status', 'Published')->orderBy('order');
            }])
            ->find($id);

        if (!$course) {
            return response()->json([
                'message' => 'Course not found or not accessible in your department.'
            ], 404);
        }

        return response()->json($course);
    }

    /**
     * Get notifications for the authenticated employee.
     */
    public function notifications(Request $request)
    {
        $user = $request->user();

        $notifications = Notification::where('user_id', $user->id)
            ->orderByRaw('read_at IS NOT NULL')  // unread first
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(function ($n) {
                return [
                    'id' => $n->id,
                    'type' => $n->type,
                    'title' => $n->title,
                    'message' => $n->message,
                    'data' => $n->data,
                    'course_id' => $n->course_id,
                    'module_id' => $n->module_id,
                    'read' => $n->read_at !== null,
                    'created_at' => $n->created_at->toISOString(),
                ];
            });

        return response()->json($notifications);
    }

    /**
     * Mark a notification as read.
     */
    public function markNotificationRead(Request $request, int $id)
    {
        $notification = Notification::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->firstOrFail();

        $notification->update(['read_at' => now()]);

        return response()->json(['message' => 'Notification marked as read.']);
    }

    /**
     * Save a quiz attempt for the authenticated employee.
     */
    public function saveQuizAttempt(Request $request, int $moduleId)
    {
        $request->validate([
            'score'           => 'required|integer|min:0|max:100',
            'correct_answers' => 'required|integer|min:0',
            'total_questions' => 'required|integer|min:1',
        ]);

        QuizAttempt::create([
            'user_id'         => $request->user()->id,
            'module_id'       => $moduleId,
            'score'           => $request->score,
            'correct_answers' => $request->correct_answers,
            'total_questions' => $request->total_questions,
        ]);

        return response()->json(['message' => 'Quiz attempt saved.']);
    }

    /**
     * Get full learning progress for the authenticated employee.
     */
    public function progress(Request $request)
    {
        $user = $request->user();

        // ── Course status counts ──────────────────────────────────────────────
        $enrollments = CourseEnrollment::where('user_id', $user->id)->get();

        $completedCount  = $enrollments->where('status', 'Completed')->count();
        $inProgressCount = $enrollments->where('status', 'Active')
                                       ->where('progress', '>', 0)->count();
        $notStartedCount = $enrollments->where('status', 'Active')
                                       ->where('progress', 0)->count();

        // ── Modules completed (from fully-completed courses) ──────────────────
        $completedCourseIds = $enrollments->where('status', 'Completed')->pluck('course_id');
        $modulesCompleted   = Module::whereIn('course_id', $completedCourseIds)->count();

        // ── Quiz stats ────────────────────────────────────────────────────────
        $attempts = QuizAttempt::where('user_id', $user->id)->get();
        $avgScore = $attempts->isNotEmpty() ? (int) round($attempts->avg('score')) : 0;

        $quizHistory = QuizAttempt::where('user_id', $user->id)
            ->with('module:id,title')
            ->orderBy('created_at', 'desc')
            ->take(10)
            ->get()
            ->map(fn ($a) => [
                'name'  => $a->module?->title ?? 'Unknown',
                'score' => $a->score,
                'date'  => $a->created_at->format('M d'),
            ]);

        // ── Weekly activity (enrollment updates this week) ────────────────────
        $startOfWeek = Carbon::now()->startOfWeek(Carbon::MONDAY);
        $dayNames    = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

        $weeklyActivity = collect($dayNames)->map(function ($day, $index) use ($user, $startOfWeek) {
            $date  = $startOfWeek->copy()->addDays($index);
            $count = CourseEnrollment::where('user_id', $user->id)
                ->whereDate('updated_at', $date->toDateString())
                ->count();
            return ['name' => $day, 'count' => $count];
        })->values();

        // ── Total learning time (sum lesson durations for enrolled courses) ───
        $courseIds    = $enrollments->pluck('course_id');
        $lessons      = Lesson::whereHas('module', fn ($q) => $q->whereIn('course_id', $courseIds))
            ->whereNotNull('duration')
            ->get(['duration']);

        $totalMinutes = 0;
        foreach ($lessons as $lesson) {
            $dur = $lesson->duration ?? '';
            if (preg_match('/(?:(\d+)\s*h(?:our)?s?)?\s*(?:(\d+)\s*m(?:in)?)?/i', $dur, $m)) {
                $totalMinutes += ((int) ($m[1] ?? 0)) * 60 + (int) ($m[2] ?? 0);
            }
        }
        $hours        = (int) floor($totalMinutes / 60);
        $mins         = $totalMinutes % 60;
        $learningTime = $totalMinutes > 0 ? "{$hours}h {$mins}m" : '0h 0m';

        return response()->json([
            'summary' => [
                'total_learning_time' => $learningTime,
                'avg_quiz_score'      => $avgScore,
                'modules_completed'   => $modulesCompleted,
            ],
            'course_status' => [
                ['name' => 'Completed',   'value' => $completedCount],
                ['name' => 'In Progress', 'value' => $inProgressCount],
                ['name' => 'Not Started', 'value' => $notStartedCount],
            ],
            'weekly_activity' => $weeklyActivity,
            'quiz_history'    => $quizHistory,
        ]);
    }
}
