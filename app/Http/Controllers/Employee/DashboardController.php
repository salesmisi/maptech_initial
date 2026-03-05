<?php

namespace App\Http\Controllers\Employee;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Notification;
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

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->fullName,
                'email' => $user->email,
                'department' => $user->department,
            ],
            'courses' => $courses,
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
}
