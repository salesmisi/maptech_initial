<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;
use App\Events\NotificationCountUpdated;
use Illuminate\Support\Carbon;

class NotificationController extends Controller
{
    /**
     * Return notifications for the authenticated user.
     */
    public function index(Request $request)
    {
        $user = $request->user() ?? Auth::user();
        if (! $user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $query = Notification::where('user_id', $user->id)->orderByDesc('created_at');

        if ($request->has('unread') && $request->unread === 'true') {
            $query->whereNull('read_at');
        }

        $perPage = (int) $request->query('per_page', 25);
        $data = $query->paginate($perPage);

        return response()->json($data);
    }

    /**
     * Mark a notification as read for the authenticated user.
     */
    public function markRead(Request $request, $id)
    {
        $user = $request->user() ?? Auth::user();
        if (! $user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $notification = Notification::where('id', $id)
            ->where('user_id', $user->id)
            ->firstOrFail();

        $notification->update(['read_at' => Carbon::now()->utc()]);

        Cache::forget("user:{$user->id}:notifications:unread_count");
        $count = Notification::where('user_id', $user->id)->whereNull('read_at')->count();
        event(new NotificationCountUpdated($user->id, $count));

        return response()->json([
            'message' => 'Notification marked as read',
            'notification' => $notification,
            'count' => $count,
        ]);
    }

    /**
     * Unread count for authenticated user
     */
    public function unreadCount(Request $request)
    {
        $user = $request->user() ?? Auth::user();
        if (! $user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $userId = (int) $user->id;
        $count = Cache::remember("user:{$userId}:notifications:unread_count", 3, function () use ($userId) {
            return Notification::where('user_id', $userId)->whereNull('read_at')->count();
        });

        return response()->json([
            'count' => $count,
        ]);
    }

    /**
     * Mark all notifications as read for authenticated user
     */
    public function readAll(Request $request)
    {
        $user = $request->user() ?? Auth::user();
        if (! $user) return response()->json(['message' => 'Unauthenticated'], 401);

        Notification::where('user_id', $user->id)
            ->whereNull('read_at')
            ->update(['read_at' => Carbon::now()->utc()]);

        // Clear cached unread count and broadcast updated count (now zero)
        Cache::forget("user:{$user->id}:notifications:unread_count");
        event(new NotificationCountUpdated($user->id, 0));

        return response()->json([
            'message' => 'All notifications marked as read',
        ]);
    }

    /**
     * Backward-compatible alias used by API routes.
     */
    public function markAsRead(Request $request, $id)
    {
        return $this->markRead($request, $id);
    }

    /**
     * Backward-compatible alias used by API routes.
     */
    public function markAllAsRead(Request $request)
    {
        return $this->readAll($request);
    }

    /**
     * Delete a notification for the authenticated user
     */
    public function destroy(Request $request, $id)
    {
        $user = $request->user() ?? Auth::user();
        if (! $user) return response()->json(['message' => 'Unauthenticated'], 401);

        $notification = Notification::where('id', $id)->where('user_id', $user->id)->firstOrFail();
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
            'department' => 'nullable|string|max:255',
            'target_user_ids' => 'nullable|array',
            'target_user_ids.*' => 'integer|exists:users,id',
        ]);

        $admin = Auth::user();

        // Temporary debug: log incoming payload for troubleshooting
        Log::debug('adminAnnounce payload', $request->all());
        $roles = $request->input('roles');
        // Normalize roles to lowercase to match storage convention in User::setRoleAttribute
        $normalizedRoles = is_array($roles) ? array_map('strtolower', $roles) : [];
        $title = $request->input('title');
        $message = $request->input('message');
        $courseId = $request->input('course_id');
        $department = $request->input('department');
        $department_id = $request->input('department_id');
        // If department_id provided, resolve to department name
        if ($department_id && !$department) {
            $dept = \App\Models\Department::find($department_id);
            if ($dept) {
                $department = $dept->name;
            }
        }

        // If specific user IDs provided, target those (respecting department/roles)
        $targetIds = $request->input('target_user_ids');
        if (is_array($targetIds) && count($targetIds) > 0) {
            $users = User::whereIn('id', $targetIds)
                ->where('id', '!=', $admin->id)
                ->when($normalizedRoles, function ($q) use ($normalizedRoles) {
                    return $q->whereIn('role', $normalizedRoles);
                })
                ->when($department, function ($q) use ($department) {
                    return $q->where('department', $department);
                })
                ->get();
        } else {
            // Get all users with specified roles
            $users = User::whereIn('role', $normalizedRoles)
                ->where('id', '!=', $admin->id)
                ->when($department, function ($q) use ($department) {
                    return $q->where('department', $department);
                })
                ->get();
        }

        // Temporary debug: log matched users (ids + count)
        Log::debug('adminAnnounce matched users', [
            'count' => $users->count(),
            'ids' => $users->pluck('id')->values()->all(),
            'department_resolved' => $department,
            'roles' => $roles,
            'roles_normalized' => $normalizedRoles,
        ]);

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

        $payload = [
            'message' => 'Announcement sent successfully',
            'recipients_count' => count($notifications),
        ];

        // If app debug is enabled, include matched user ids for troubleshooting
        if (config('app.debug')) {
            $payload['matched_user_ids'] = $users->pluck('id')->values()->all();
        }

        return response()->json($payload);
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
            'course_id' => 'nullable|exists:courses,id',
            'department' => 'nullable|string|max:255',
            'department_id' => 'nullable|integer|exists:departments,id',
            'type' => 'nullable|string|in:announcement,lesson_update,quiz_reminder',
        ]);

        /** @var User|null $instructor */
        $instructor = Auth::user();
        if (! $instructor) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $courseId = $request->input('course_id');
        $department = $request->input('department');
        $departmentId = $request->input('department_id');

        // If department_id provided, resolve to name
        if ($departmentId && !$department) {
            $dept = \App\Models\Department::find($departmentId);
            if ($dept) $department = $dept->name;
        }

        $notifications = [];
        $recipients = collect();

        if ($courseId) {
            // Verify instructor has access to the course (ownership or assigned area)
            $course = \App\Models\Course::findOrFail($courseId);
            $assignedSubIds = $instructor->subdepartments()->pluck('subdepartments.id')->toArray();
            $assignedDept = $instructor->department;

            $allowed = ($course->instructor_id === $instructor->id)
                || (!empty($assignedSubIds) && in_array($course->subdepartment_id, $assignedSubIds))
                || ($assignedDept && $course->department === $assignedDept);

            if (!$allowed) {
                return response()->json(['message' => 'Forbidden'], 403);
            }

            $enrollments = \App\Models\Enrollment::where('course_id', $courseId)->with('user')->get();
            foreach ($enrollments as $enrollment) {
                $recipients->push([$enrollment->user_id, $course->title, $course->id]);
            }
        } elseif ($department) {
            // Send to enrolled employees across courses in the department that the instructor can manage
            $assignedSubIds = $instructor->subdepartments()->pluck('subdepartments.id')->toArray();
            $assignedDept = $instructor->department;

            // Instructor must belong to the department or have assigned subdepartments matching the department
            if (!($assignedDept === $department) && empty($assignedSubIds)) {
                return response()->json(['message' => 'Forbidden'], 403);
            }

            $courses = \App\Models\Course::where('department', $department)
                ->get()
                ->filter(function ($c) use ($instructor, $assignedSubIds, $assignedDept) {
                    return ($c->instructor_id === $instructor->id)
                        || (!empty($assignedSubIds) && in_array($c->subdepartment_id, $assignedSubIds))
                        || ($assignedDept && $c->department === $assignedDept);
                });

            foreach ($courses as $course) {
                $enrollments = \App\Models\Enrollment::where('course_id', $course->id)->with('user')->get();
                foreach ($enrollments as $enrollment) {
                    $recipients->push([$enrollment->user_id, $course->title, $course->id]);
                }
            }
        } else {
            return response()->json(['message' => 'Please provide course_id or department'], 422);
        }

        // Deduplicate recipients by user_id
        $unique = $recipients->unique(function ($item) { return $item[0]; });

        foreach ($unique as $item) {
            [$userId, $courseTitle, $courseIdForData] = $item;
            $notifications[] = Notification::create([
                'user_id' => $userId,
                'course_id' => $courseIdForData,
                'type' => $request->input('type', 'announcement'),
                'title' => $request->input('title'),
                'message' => $request->input('message'),
                'data' => [
                    'from_user_id' => $instructor->id,
                    'from_user_name' => $instructor->fullname,
                    'from_role' => 'Instructor',
                    'course_title' => $courseTitle,
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
