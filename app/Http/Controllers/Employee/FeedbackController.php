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
        // Only return lessons from courses the user is enrolled in
        $courseIds = Enrollment::where('user_id', $user->id)->pluck('course_id')->toArray();

        $lessons = Lesson::whereIn('module_id', function ($q) use ($courseIds) {
            $q->select('id')->from('modules')->whereIn('course_id', $courseIds);
        })
        ->with('module:id,title,course_id', 'module.course:id,title,department')
        ->orderBy('module_id')
        ->orderBy('order')
        ->get()
        ->map(function ($lesson) {
            return [
                'id'           => $lesson->id,
                'title'        => $lesson->title,
                'module_title' => $lesson->module?->title ?? '',
                'course_title' => $lesson->module?->course?->title ?? '',
                'course_department' => $lesson->module?->course?->department ?? null,
            ];
        });

        return response()->json($lessons);
    }

    /**
     * Get quizzes from enrolled courses for the feedback dropdown.
     */
    public function enrolledQuizzes(Request $request)
    {
        $user = $request->user();
        $courseIds = Enrollment::where('user_id', $user->id)->pluck('course_id')->toArray();

        $quizzes = \App\Models\Quiz::whereIn('module_id', function ($q) use ($courseIds) {
            $q->select('id')->from('modules')->whereIn('course_id', $courseIds);
        })
        ->with('module:id,title,course_id', 'module.course:id,title,department')
        ->orderBy('module_id')
        ->get()
        ->map(function ($quiz) {
            return [
                'id' => $quiz->id,
                'title' => $quiz->title,
                'module_title' => $quiz->module?->title ?? '',
                'course_title' => $quiz->module?->course?->title ?? '',
                'course_department' => $quiz->module?->course?->department ?? null,
            ];
        });

        return response()->json($quizzes);
    }

    /**
     * Store a new quiz feedback.
     */
    public function storeQuiz(Request $request)
    {
        $validated = $request->validate([
            'quiz_id'  => 'required|exists:quizzes,id',
            'rating'   => 'required|integer|min:1|max:5',
            'comment'  => 'nullable|string|max:1000',
        ]);

        $user = $request->user();

        // confirm enrollment in quiz's course
        $quiz = \App\Models\Quiz::with('module.course:id')->find($validated['quiz_id']);
        if (!$quiz) return response()->json(['message' => 'Quiz not found'], 404);

        $courseId = $quiz->module?->course?->id ?? null;
        if (!$courseId || !Enrollment::where('user_id', $user->id)->where('course_id', $courseId)->exists()) {
            return response()->json(['message' => 'You are not enrolled in this quiz\'s course'], 403);
        }

        // prevent duplicate
        if (\App\Models\QuizFeedback::where('user_id', $user->id)->where('quiz_id', $validated['quiz_id'])->exists()) {
            return response()->json(['message' => 'You have already given feedback for this quiz.'], 422);
        }

        $fb = \App\Models\QuizFeedback::create([
            'user_id' => $user->id,
            'quiz_id' => $validated['quiz_id'],
            'rating'  => $validated['rating'],
            'comment' => $validated['comment'] ?? null,
        ]);

        return response()->json($fb->load('quiz.module.course:id,title'), 201);
    }

    public function updateQuiz(Request $request, $id)
    {
        $fb = \App\Models\QuizFeedback::where('user_id', $request->user()->id)->findOrFail($id);
        $validated = $request->validate([
            'rating' => 'required|integer|min:1|max:5',
            'comment' => 'nullable|string|max:1000',
        ]);
        $fb->update($validated);
        return response()->json($fb);
    }

    public function destroyQuiz(Request $request, $id)
    {
        $fb = \App\Models\QuizFeedback::where('user_id', $request->user()->id)->findOrFail($id);
        $fb->delete();
        return response()->json(['message' => 'Quiz feedback deleted']);
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

        // Ensure the lesson belongs to the user's department
        $lesson = Lesson::with('module.course:id,department')->find($validated['lesson_id']);
        if (!$lesson || ($lesson->module?->course?->department ?? null) !== $request->user()->department) {
            return response()->json([
                'message' => 'You are not allowed to give feedback for lessons outside your department.'
            ], 403);
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

    /**
     * List quiz feedbacks for authenticated employee.
     */
    public function quizIndex(Request $request)
    {
        $feedbacks = \App\Models\QuizFeedback::where('user_id', $request->user()->id)
            ->with('quiz.module.course:id,title,department')
            ->orderByDesc('created_at')
            ->get()
            ->map(function ($fb) {
                return [
                    'id' => $fb->id,
                    'quiz_id' => $fb->quiz_id,
                    'quiz_title' => $fb->quiz?->title ?? 'Unknown Quiz',
                    'module_title' => $fb->quiz?->module?->title ?? '',
                    'course_title' => $fb->quiz?->module?->course?->title ?? '',
                    'rating' => $fb->rating,
                    'comment' => $fb->comment,
                    'created_at' => $fb->created_at->toISOString(),
                    'date' => $fb->created_at->format('Y-m-d'),
                ];
            });

        return response()->json($feedbacks);
    }
}
