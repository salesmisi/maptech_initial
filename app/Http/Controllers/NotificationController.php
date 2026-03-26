<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

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
        if (! $user) return response()->json(['message' => 'Unauthenticated'], 401);

        $notification = Notification::where('id', $id)->where('user_id', $user->id)->firstOrFail();
        $notification->read_at = now();
        $notification->save();

        return response()->json(['message' => 'Marked read']);
    }

    /**
     * Unread count for authenticated user
     */
    public function unreadCount(Request $request)
    {
        $user = $request->user() ?? Auth::user();
        if (! $user) return response()->json(['message' => 'Unauthenticated'], 401);

        $count = Notification::where('user_id', $user->id)->whereNull('read_at')->count();
        return response()->json(['count' => $count]);
    }

    /**
     * Mark all notifications as read for authenticated user
     */
    public function readAll(Request $request)
    {
        $user = $request->user() ?? Auth::user();
        if (! $user) return response()->json(['message' => 'Unauthenticated'], 401);

        Notification::where('user_id', $user->id)->whereNull('read_at')->update(['read_at' => now()]);
        return response()->json(['message' => 'All marked read']);
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

        return response()->json(['message' => 'Deleted']);
    }
}
