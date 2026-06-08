<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Models\User;
use App\Models\Department;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;

class NotificationController extends Controller
{
    /**
     * Create notifications targeted to a user or all users in a department.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'message' => 'nullable|string',
            'target_type' => ['required', 'in:user,department'],
            'target_id' => 'required|integer',
        ]);

        $title = $validated['title'];
        $message = $validated['message'] ?? null;
        $targetType = $validated['target_type'];
        $targetId = (int) $validated['target_id'];

        if ($targetType === 'user') {
            $user = User::find($targetId);
            if (! $user) {
                return response()->json(['message' => 'User not found'], 404);
            }

            $notification = Notification::create([
                'user_id' => $user->id,
                'target_type' => 'user',
                'target_id' => $user->id,
                'title' => $title,
                'message' => $message,
            ]);

            return response()->json(['message' => 'Notification sent', 'notification' => $notification], 201);
        }

        // department
        $department = Department::find($targetId);
        if (! $department) {
            return response()->json(['message' => 'Department not found'], 404);
        }

        $users = User::where('department', $department->name)->get(['id']);

        if ($users->isEmpty()) {
            return response()->json(['message' => 'No users in department'], 422);
        }

        $now = now();
        $rows = [];
        foreach ($users as $u) {
            $rows[] = [
                'user_id' => $u->id,
                'target_type' => 'department',
                'target_id' => $department->id,
                'title' => $title,
                'message' => $message,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        DB::table('notifications')->insert($rows);

        return response()->json(['message' => 'Notifications sent', 'count' => count($rows)], 201);
    }

    /**
     * Get notifications for the authenticated admin user (received)
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $query = Notification::where('user_id', $user->id)->orderByDesc('created_at');

        $perPage = (int) $request->query('per_page', 25);
        $data = $query->paginate($perPage);

        return response()->json($data);
    }

    /**
     * Unread count for authenticated user
     */
    public function unreadCount(Request $request)
    {
        $user = $request->user();
        $count = Notification::where('user_id', $user->id)->whereNull('read_at')->count();
        return response()->json(['count' => $count]);
    }

    /**
     * Mark a notification as read for the authenticated user
     */
    public function markRead(Request $request, $id)
    {
        $user = $request->user();
        $notification = Notification::where('id', $id)->where('user_id', $user->id)->firstOrFail();
        $notification->read_at = now();
        $notification->save();
        return response()->json(['message' => 'Marked read']);
    }

    /**
     * Mark all notifications as read for authenticated user
     */
    public function readAll(Request $request)
    {
        $user = $request->user();
        Notification::where('user_id', $user->id)->whereNull('read_at')->update(['read_at' => now()]);
        return response()->json(['message' => 'All marked read']);
    }

    /**
     * Delete a notification (owner only)
     */
    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        $notification = Notification::where('id', $id)->where('user_id', $user->id)->firstOrFail();
        $notification->delete();
        return response()->json(['message' => 'Deleted']);
    }

    /**
     * Announce to roles (admin feature) - similar to existing announcements
     */
    public function announce(Request $request)
    {
        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'message' => 'nullable|string',
            'roles' => 'required|array|min:1',
            'course_id' => 'nullable|string',
        ]);

        $roles = $validated['roles'];
        $title = $validated['title'];
        $message = $validated['message'] ?? null;
        $courseId = $validated['course_id'] ?? null;

        $users = User::whereIn('role', array_map('strtolower', $roles))->get(['id']);
        if ($users->isEmpty()) {
            return response()->json(['message' => 'No recipients found', 'recipients_count' => 0], 422);
        }

        // If preview flag is present, do not insert rows — just return recipient count
        if ($request->boolean('preview')) {
            return response()->json(['message' => 'Preview', 'recipients_count' => $users->count()]);
        }

        $now = now();
        $rows = [];
        foreach ($users as $u) {
            $rows[] = [
                'user_id' => $u->id,
                'target_type' => 'roles',
                'target_id' => null,
                'title' => $title,
                'message' => $message,
                'data' => $courseId ? json_encode(['course_id' => $courseId]) : null,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        DB::table('notifications')->insert($rows);

        return response()->json(['message' => 'Announcements sent', 'recipients_count' => count($rows)], 201);
    }
}
