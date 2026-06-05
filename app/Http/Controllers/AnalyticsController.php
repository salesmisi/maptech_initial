<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\LessonEvent;

class AnalyticsController extends Controller
{
    public function recordLessonEvent(Request $request)
    {
        $validated = $request->validate([
            'lesson_id' => 'nullable|integer',
            'event_type' => 'required|string',
            'data' => 'nullable|array',
        ]);

        $user = $request->user();

        $event = LessonEvent::create([
            'user_id' => $user ? $user->id : null,
            'lesson_id' => $validated['lesson_id'] ?? null,
            'event_type' => $validated['event_type'],
            'data' => $validated['data'] ?? null,
        ]);

        return response()->json(['message' => 'Event recorded', 'id' => $event->id]);
    }

    // Admin: get recent lesson events (optionally filter by lesson or user)
    public function recentLessonEvents(Request $request)
    {
        $this->authorize('admin'); // Only allow admins (assumes policy/gate)

        $query = \App\Models\LessonEvent::query()->with(['user:id,fullname,email', 'lesson_id']);
        if ($request->has('lesson_id')) {
            $query->where('lesson_id', $request->lesson_id);
        }
        if ($request->has('user_id')) {
            $query->where('user_id', $request->user_id);
        }
        $events = $query->orderByDesc('created_at')->limit(100)->get();
        return response()->json(['data' => $events]);
    }
}
