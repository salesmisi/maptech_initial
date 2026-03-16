<?php

namespace App\Http\Controllers;

use App\Events\TimeLogUpdated;
use App\Models\TimeLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Carbon;

class TimeLogController extends Controller
{
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
    public function punchIn(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        // Always create a new time log on punch-in (allow multiple open sessions)

        $validated = $request->validate([
            'note' => 'nullable|string|max:255',
        ]);

        $ts = Carbon::now()->utc();
        $timeLog = TimeLog::create([
            'user_id' => $user->id,
            'time_in' => $ts,
            'note' => $validated['note'] ?? null,
        ]);

        event(new TimeLogUpdated($timeLog->fresh()));

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

        $open->time_out = Carbon::now()->utc();
        if (isset($validated['note'])) {
            $open->note = $validated['note'];
        }
        $open->save();

        event(new TimeLogUpdated($open->fresh()));

        return response()->json($open);
    }

    public function myLogs(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $logs = TimeLog::where('user_id', $user->id)->orderByDesc('time_in')->get();

        // For each time log, try to find matching audit logs (login/logout) and prefer their timestamps
        $enhanced = $logs->map(function ($tl) use ($user) {
            $displayIn = $tl->time_in;
            $displayOut = $tl->time_out;

            try {
                // Find closest login audit near time_in (within 5 minutes)
                if ($tl->time_in) {
                    $login = \App\Models\AuditLog::where('user_id', $user->id)
                        ->where('action', 'login')
                        ->where('created_at', '>=', \Carbon\Carbon::parse($tl->time_in)->subMinutes(5))
                        ->where('created_at', '<=', \Carbon\Carbon::parse($tl->time_in)->addMinutes(5))
                        ->orderBy('created_at')
                        ->first();
                    if ($login) $displayIn = $login->created_at;
                }

                // Find logout audit corresponding to this time log (after time_in and before time_out+5m)
                if ($tl->time_out) {
                    $logout = \App\Models\AuditLog::where('user_id', $user->id)
                        ->where('action', 'logout')
                        ->where('created_at', '>=', \Carbon\Carbon::parse($tl->time_in)->subMinutes(1))
                        ->where('created_at', '<=', \Carbon\Carbon::parse($tl->time_out)->addMinutes(5))
                        ->orderBy('created_at')
                        ->first();
                    if ($logout) $displayOut = $logout->created_at;
                }
            } catch (\Exception $e) {
                // ignore parsing errors
            }

            $arr = $tl->toArray();
            $arr['display_time_in'] = $displayIn ? optional($displayIn)->toIso8601String() : null;
            $arr['display_time_out'] = $displayOut ? optional($displayOut)->toIso8601String() : null;
            return $arr;
        });

        return response()->json($enhanced);
    }
}
