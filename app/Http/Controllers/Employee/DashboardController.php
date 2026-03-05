<?php

namespace App\Http\Controllers\Employee;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Enrollment;
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
     * Get a specific course (only if in employee's department).
     */
    public function showCourse(Request $request, string $id)
    {
        $user = $request->user();

        $course = Course::active()
            ->with('instructor:id,fullname,email', 'modules:id,title,content_path,course_id')
            ->find($id);

        if (!$course) {
            return response()->json(['message' => 'Course not found or not accessible.'], 404);
        }

        return response()->json($course);
    }
}
