<?php

namespace App\Http\Controllers\Employee;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use Illuminate\Http\Request;
use Carbon\Carbon;

class DashboardController extends Controller
{
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

        $courses = Course::forDepartment($user->department)
            ->active()
            ->with('instructor:id,fullname,email', 'modules:id,title,content_path,course_id')
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
            'user'          => [
                'id'         => $user->id,
                'name'       => $user->fullname,
                'email'      => $user->email,
                'department' => $user->department,
            ],
            'courses'       => $courses,
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
            ->orderBy('title')
            ->get();

        // Index enrollments by course_id for O(1) lookup
        $enrollments = Enrollment::where('user_id', $user->id)
            ->whereIn('course_id', $courses->pluck('id'))
            ->get()
            ->keyBy('course_id');

        $result = $courses->map(function (Course $course) use ($enrollments) {
            $enrollment = $enrollments->get($course->id);
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
                $q->forDepartment($user->department)
                  ->with('instructor:id,fullname,email', 'modules:id,title,course_id');
            }])
            ->get()
            ->filter(fn ($e) => $e->course !== null);

        // Recalculate progress for all enrollments from quiz attempts
        foreach ($enrollments as $enrollment) {
            Enrollment::recalculateProgress($user->id, $enrollment->course_id);
            $enrollment->refresh();
        }

        $result = $enrollments->map(function (Enrollment $enrollment) {
            $course = $enrollment->course;
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

        if (Enrollment::where('user_id', $user->id)->where('course_id', $id)->exists()) {
            return response()->json(['message' => 'You are already enrolled in this course.'], 409);
        }

        Enrollment::create([
            'user_id'     => $user->id,
            'course_id'   => $id,
            'status'      => 'Not Started',
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

        // Load quizzes for every module in this course (keyed by module_id)
        $moduleIds      = $course->modules->pluck('id');
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
            $bestAttempts
        ) {
            $isUnlocked = $previousUnlocked;

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
}
