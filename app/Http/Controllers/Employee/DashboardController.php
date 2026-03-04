<?php

namespace App\Http\Controllers\Employee;

use App\Http\Controllers\Controller;
use App\Models\Course;
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
            ->with('instructor:id,fullname,email')
            ->with('modules:id,title,content_path,course_id')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->fullname,
                'email' => $user->email,
                'department' => $user->department,
            ],
            'courses' => $courses,
            'total_courses' => $courses->count(),
        ]);
    }

    /**
     * Get employee's available courses filtered by their department.
     */
    public function courses(Request $request)
    {
        $user = $request->user();
        $department = $user->department;

        $courses = Course::forDepartment($department)
            ->active()
            ->with('instructor:id,fullname,email')
            ->with('modules:id,title,content_path,course_id')
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
            ->with('instructor:id,fullname,email')
            ->with('modules:id,title,content_path,course_id')
            ->find($id);

        if (!$course) {
            return response()->json([
                'message' => 'Course not found or not accessible in your department.'
            ], 404);
        }

        return response()->json($course);
    }
}
