<?php

namespace App\Http\Controllers;

use App\Events\TimeLogUpdated;
use App\Models\TimeLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

class TimeLogController extends Controller
    /**
     * Get all time logs for a specific user (admin/instructor only)
     */
    public function userLogs(Request $request, $userId)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }
        // Only allow Admin or Instructor roles
        if (!($user->role === 'Admin' || $user->role === 'Instructor')) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        $logs = \App\Models\TimeLog::where('user_id', $userId)->orderByDesc('time_in')->get();
        return response()->json($logs);
    }
{
    public function punchIn(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        // Prevent multiple open sessions
        $open = TimeLog::where('user_id', $user->id)->whereNull('time_out')->first();
        if ($open) {
            return response()->json(['message' => 'Already punched in', 'time_log' => $open], 422);
        }

        $validated = $request->validate([
            'note' => 'nullable|string|max:255',
        ]);

        $timeLog = TimeLog::create([
            'user_id' => $user->id,
            'time_in' => now(),
            'note' => $validated['note'] ?? null,
        ]);

        event(new TimeLogUpdated($timeLog));

        return response()->json($timeLog, 201);
    }

    public function punchOut(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $open = TimeLog::where('user_id', $user->id)->whereNull('time_out')->latest('time_in')->first();
        if (!$open) {
            return response()->json(['message' => 'No open time-in found'], 422);
        }

        $validated = $request->validate([
            'note' => 'nullable|string|max:255',
        ]);

        $open->time_out = now();
        if (isset($validated['note'])) {
            $open->note = $validated['note'];
        }
        $open->save();

        event(new TimeLogUpdated($open));

        return response()->json($open);
    }

    public function myLogs(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $logs = TimeLog::where('user_id', $user->id)->orderByDesc('time_in')->get();

        return response()->json($logs);
    }
}
