<?php

namespace App\Http\Controllers\Employee;

use App\Http\Controllers\Controller;
use App\Models\LessonFeedback;
use App\Models\Lesson;
use App\Models\Enrollment;
use Illuminate\Http\Request;

class FeedbackController extends Controller
{
    /**
     * List all feedbacks for the authenticated employee.
     */
    public function index(Request $request)
    {
        $feedbacks = LessonFeedback::where('user_id', $request->user()->id)
            ->with('lesson.module.course:id,title,department')
            ->orderByDesc('created_at')
            ->get()
            ->map(function ($fb) {
                return [
                    'id'          => $fb->id,
                    'lesson_id'   => $fb->lesson_id,
                    'lesson_title' => $fb->lesson?->title ?? 'Unknown Lesson',
                    'module_title' => $fb->lesson?->module?->title ?? '',
                    'course_title' => $fb->lesson?->module?->course?->title ?? '',
                    'rating'      => $fb->rating,
                    'comment'     => $fb->comment,
                    'created_at'  => $fb->created_at->toISOString(),
                    'date'        => $fb->created_at->format('Y-m-d'),
                ];
            });

        return response()->json($feedbacks);
    }

    /**
     * Get lessons from enrolled courses for the feedback dropdown.
     */
    public function enrolledLessons(Request $request)
    {
        $user = $request->user();

        $enrolledCourseIds = Enrollment::where('user_id', $user->id)
            ->pluck('course_id');

        $lessons = Lesson::whereHas('module', function ($q) use ($enrolledCourseIds) {
            $q->whereIn('course_id', $enrolledCourseIds);
        })
        ->with('module:id,title,course_id', 'module.course:id,title')
        ->orderBy('module_id')
        ->orderBy('order')
        ->get()
        ->map(function ($lesson) {
            return [
                'id'           => $lesson->id,
                'title'        => $lesson->title,
                'module_title' => $lesson->module?->title ?? '',
                'course_title' => $lesson->module?->course?->title ?? '',
            ];
        });

        return response()->json($lessons);
    }

    /**
     * Store a new lesson feedback.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'lesson_id' => 'required|exists:lessons,id',
            'rating'    => 'required|integer|min:1|max:5',
            'comment'   => 'nullable|string|max:1000',
        ]);

        $existing = LessonFeedback::where('user_id', $request->user()->id)
            ->where('lesson_id', $validated['lesson_id'])
            ->first();

        if ($existing) {
            return response()->json([
                'message' => 'You have already given feedback for this lesson.',
            ], 422);
        }

        $feedback = LessonFeedback::create([
            'user_id'   => $request->user()->id,
            'lesson_id' => $validated['lesson_id'],
            'rating'    => $validated['rating'],
            'comment'   => $validated['comment'],
        ]);

        return response()->json($feedback->load('lesson.module.course:id,title'), 201);
    }

    /**
     * Update an existing feedback.
     */
    public function update(Request $request, $id)
    {
        $feedback = LessonFeedback::where('user_id', $request->user()->id)
            ->findOrFail($id);

        $validated = $request->validate([
            'rating'  => 'required|integer|min:1|max:5',
            'comment' => 'nullable|string|max:1000',
        ]);

        $feedback->update($validated);

        return response()->json($feedback);
    }

    /**
     * Delete a feedback.
     */
    public function destroy(Request $request, $id)
    {
        $feedback = LessonFeedback::where('user_id', $request->user()->id)
            ->findOrFail($id);

        $feedback->delete();

        return response()->json(['message' => 'Feedback deleted']);
    }
}
