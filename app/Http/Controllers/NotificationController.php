<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class NotificationController extends Controller
{
    /**
     * Get all notifications for the authenticated user.
     */
    public function index(Request $request)
    {
        $user = Auth::user();

        $query = Notification::where('user_id', $user->id)
            ->orderByDesc('created_at');

        // Filter by read status
        if ($request->has('unread') && $request->unread === 'true') {
            $query->whereNull('read_at');
        }

        // Filter by type
        if ($request->has('type')) {
            $query->where('type', $request->type);
        }

        $notifications = $query->paginate($request->input('per_page', 20));

        return response()->json([
            'notifications' => $notifications,
            'unread_count' => Notification::where('user_id', $user->id)->whereNull('read_at')->count(),
        ]);
    }

    /**
     * Get unread notification count.
     */
    public function unreadCount()
    {
        $user = Auth::user();

        return response()->json([
            'count' => Notification::where('user_id', $user->id)->whereNull('read_at')->count(),
        ]);
    }

    /**
     * Mark a notification as read.
     */
    public function markAsRead(int $id)
    {
        $user = Auth::user();

        $notification = Notification::where('id', $id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        $notification->update(['read_at' => now()]);

        return response()->json([
            'message' => 'Notification marked as read',
            'notification' => $notification,
        ]);
    }

    /**
     * Mark all notifications as read.
     */
    public function markAllAsRead()
    {
        $user = Auth::user();

        Notification::where('user_id', $user->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json([
            'message' => 'All notifications marked as read',
        ]);
    }

    /**
     * Delete a notification.
     */
    public function destroy(int $id)
    {
        $user = Auth::user();

        $notification = Notification::where('id', $id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        $notification->delete();

        return response()->json([
            'message' => 'Notification deleted',
        ]);
    }

    /**
     * Admin: Send announcement to specific roles.
     */
    public function adminAnnounce(Request $request)
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'message' => 'required|string',
            'roles' => 'required|array|min:1',
            'roles.*' => 'string|in:Instructor,Employee,Admin',
            'course_id' => 'nullable|exists:courses,id',
        ]);

        $admin = Auth::user();
        $roles = $request->input('roles');
        $title = $request->input('title');
        $message = $request->input('message');
        $courseId = $request->input('course_id');

        // Get all users with specified roles
        $users = User::whereIn('role', $roles)
            ->where('id', '!=', $admin->id)
            ->get();

        $notifications = [];
        foreach ($users as $user) {
            $notifications[] = Notification::create([
                'user_id' => $user->id,
                'course_id' => $courseId,
                'type' => 'announcement',
                'title' => $title,
                'message' => $message,
                'data' => [
                    'from_user_id' => $admin->id,
                    'from_user_name' => $admin->fullname,
                    'from_role' => 'Admin',
                ],
            ]);
        }

        return response()->json([
            'message' => 'Announcement sent successfully',
            'recipients_count' => count($notifications),
        ]);
    }

    /**
     * Admin: Send notification to specific user.
     */
    public function adminNotifyUser(Request $request)
    {
        $request->validate([
            'user_id' => 'required|exists:users,id',
            'title' => 'required|string|max:255',
            'message' => 'required|string',
            'type' => 'nullable|string|in:announcement,info,warning,alert',
            'course_id' => 'nullable|exists:courses,id',
        ]);

        $admin = Auth::user();

        $notification = Notification::create([
            'user_id' => $request->input('user_id'),
            'course_id' => $request->input('course_id'),
            'type' => $request->input('type', 'announcement'),
            'title' => $request->input('title'),
            'message' => $request->input('message'),
            'data' => [
                'from_user_id' => $admin->id,
                'from_user_name' => $admin->fullname,
                'from_role' => 'Admin',
            ],
        ]);

        return response()->json([
            'message' => 'Notification sent successfully',
            'notification' => $notification,
        ]);
    }

    /**
     * Instructor: Send notification to enrolled employees in their courses.
     */
    public function instructorNotify(Request $request)
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'message' => 'required|string',
            'course_id' => 'required|exists:courses,id',
            'type' => 'nullable|string|in:announcement,lesson_update,quiz_reminder',
        ]);

        $instructor = Auth::user();
        $courseId = $request->input('course_id');

        // Verify instructor owns this course
        $course = \App\Models\Course::where('id', $courseId)
            ->where('instructor_id', $instructor->id)
            ->firstOrFail();

        // Get all enrolled employees
        $enrollments = \App\Models\Enrollment::where('course_id', $courseId)
            ->with('user')
            ->get();

        $notifications = [];
        foreach ($enrollments as $enrollment) {
            $notifications[] = Notification::create([
                'user_id' => $enrollment->user_id,
                'course_id' => $courseId,
                'type' => $request->input('type', 'announcement'),
                'title' => $request->input('title'),
                'message' => $request->input('message'),
                'data' => [
                    'from_user_id' => $instructor->id,
                    'from_user_name' => $instructor->fullname,
                    'from_role' => 'Instructor',
                    'course_title' => $course->title,
                ],
            ]);
        }

        return response()->json([
            'message' => 'Notification sent to enrolled employees',
            'recipients_count' => count($notifications),
        ]);
    }

    /**
     * Employee: Send notification/question to instructor of a course.
     */
    public function employeeNotifyInstructor(Request $request)
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'message' => 'required|string',
            'course_id' => 'required|exists:courses,id',
        ]);

        $employee = Auth::user();
        $courseId = $request->input('course_id');

        // Verify employee is enrolled in this course
        $enrollment = \App\Models\Enrollment::where('course_id', $courseId)
            ->where('user_id', $employee->id)
            ->firstOrFail();

        // Get the course and instructor
        $course = \App\Models\Course::findOrFail($courseId);

        if (!$course->instructor_id) {
            return response()->json([
                'message' => 'This course has no assigned instructor',
            ], 400);
        }

        // Send notification to instructor
        $notification = Notification::create([
            'user_id' => $course->instructor_id,
            'course_id' => $courseId,
            'type' => 'employee_message',
            'title' => $request->input('title'),
            'message' => $request->input('message'),
            'data' => [
                'from_user_id' => $employee->id,
                'from_user_name' => $employee->fullname,
                'from_role' => 'Employee',
                'course_title' => $course->title,
            ],
        ]);

        return response()->json([
            'message' => 'Notification sent to instructor',
            'notification' => $notification,
        ]);
    }

    /**
     * Employee: Report to admin.
     */
    public function employeeReportToAdmin(Request $request)
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'message' => 'required|string',
            'type' => 'nullable|string|in:feedback,issue,suggestion',
        ]);

        $employee = Auth::user();

        // Get all admins
        $admins = User::where('role', 'Admin')->get();

        $notifications = [];
        foreach ($admins as $admin) {
            $notifications[] = Notification::create([
                'user_id' => $admin->id,
                'type' => $request->input('type', 'feedback'),
                'title' => $request->input('title'),
                'message' => $request->input('message'),
                'data' => [
                    'from_user_id' => $employee->id,
                    'from_user_name' => $employee->fullname,
                    'from_role' => 'Employee',
                    'from_department' => $employee->department,
                ],
            ]);
        }

        return response()->json([
            'message' => 'Report sent to admin',
            'recipients_count' => count($notifications),
        ]);
    }
}
