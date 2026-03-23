<?php

namespace App\Http\Controllers;

use App\Models\Question;
use App\Models\QuestionReply;
use App\Models\QuestionReplyReaction;
use App\Models\Course;
use App\Models\Lesson;
use App\Models\Enrollment;
use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class QAController extends Controller
{
    /**
     * Employee: list own questions (with course, answerer, and replies).
     */
    public function employeeIndex(Request $request)
    {
        $questions = Question::where('user_id', $request->user()->id)
            ->when($request->filled('lesson_id'), function ($q) use ($request) {
                $q->where('lesson_id', $request->lesson_id);
            })
            ->with(['user:id,fullname,role', 'course:id,title', 'lesson:id,title', 'answerer:id,fullname', 'replies.user:id,fullname,role', 'replies.reactions'])
            ->orderByDesc('created_at')
            ->get();

        return response()->json($questions);
    }

    /**
     * Employee: submit a new question.
     */
    public function employeeStore(Request $request)
    {
        $validated = $request->validate([
            'course_id' => 'required_without:lesson_id|exists:courses,id',
            'lesson_id' => 'nullable|exists:lessons,id',
            'question'  => 'required|string|max:2000',
        ]);

        // If a lesson_id is provided, derive the course_id from the lesson.
        if (!empty($validated['lesson_id'])) {
            $lesson = \App\Models\Lesson::findOrFail($validated['lesson_id']);
            $courseId = $lesson->module->course_id ?? $validated['course_id'] ?? null;
        } else {
            $courseId = $validated['course_id'] ?? null;
        }

        $question = Question::create([
            'user_id'   => $request->user()->id,
            'course_id' => $courseId,
            'lesson_id' => $validated['lesson_id'] ?? null,
            'question'  => $validated['question'],
        ]);

        $question->load(['course:id,title', 'answerer:id,fullname', 'replies.user:id,fullname,role', 'replies.reactions']);

        return response()->json($question, 201);
    }

    /**
     * Employee: update own unanswered question.
     */
    public function employeeUpdate(Request $request, int $id)
    {
        $question = Question::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->whereNull('answer')
            ->firstOrFail();

        $validated = $request->validate([
            'question' => 'required|string|max:2000',
        ]);

        $question->update(['question' => $validated['question']]);
        $question->load(['course:id,title', 'answerer:id,fullname', 'replies.user:id,fullname,role', 'replies.reactions']);

        return response()->json($question);
    }

    /**
     * Employee: delete own unanswered question.
     */
    public function employeeDestroy(Request $request, int $id)
    {
        $question = Question::where('id', $id)
            ->where('user_id', $request->user()->id)
            ->whereNull('answer')
            ->firstOrFail();

        $question->delete();

        return response()->json(['message' => 'Question deleted']);
    }

    /**
     * Admin: list all questions across all courses.
     */
    public function adminIndex(Request $request)
    {
        $query = Question::with([
            'user:id,fullname,department,role',
            'course:id,title',
            'lesson:id,title',
            'answerer:id,fullname',
            'replies.user:id,fullname,role',
            'replies.reactions',
        ])->orderByDesc('created_at');

        if ($request->has('status')) {
            if ($request->status === 'unanswered') {
                $query->whereDoesntHave('replies');
            } elseif ($request->status === 'answered') {
                $query->whereHas('replies');
            }
        }

        if ($request->filled('lesson_id')) {
            $query->where('lesson_id', $request->lesson_id);
        }

        return response()->json($query->get());
    }

    /**
     * Instructor: list questions for courses they teach.
     */
    public function instructorIndex(Request $request)
    {
        $instructorId = $request->user()->id;

        $courseIds = Course::where('instructor_id', $instructorId)->pluck('id');

        $query = Question::whereIn('course_id', $courseIds)
            ->with([
                'user:id,fullname,department,role',
                'course:id,title',
                'lesson:id,title',
                'answerer:id,fullname',
                'replies.user:id,fullname,role',
                'replies.reactions',
            ])
            ->orderByDesc('created_at');

        if ($request->has('status')) {
            if ($request->status === 'unanswered') {
                $query->whereDoesntHave('replies');
            } elseif ($request->status === 'answered') {
                $query->whereHas('replies');
            }
        }

        if ($request->filled('lesson_id')) {
            $query->where('lesson_id', $request->lesson_id);
        }

        return response()->json($query->get());
    }

    /**
     * Admin: post or update an answer (legacy single-answer).
     */
    public function adminAnswer(Request $request, int $id)
    {
        $question = Question::findOrFail($id);

        $validated = $request->validate([
            'answer' => 'required|string|max:5000',
        ]);

        $question->update([
            'answer'      => $validated['answer'],
            'answered_by' => $request->user()->id,
            'answered_at' => Carbon::now()->utc(),
        ]);

        $question->load(['user:id,fullname,department', 'course:id,title', 'answerer:id,fullname', 'replies.user:id,fullname,role', 'replies.reactions']);

        // Notify the question owner that their question has been answered
        $answerer = $request->user();
        if ($question->user_id && $answerer && $question->user_id !== $answerer->id) {
            Notification::create([
                'user_id'   => $question->user_id,
                'course_id' => $question->course_id,
                'type'      => 'qa_answer',
                'title'     => 'Your question has been answered',
                'message'   => $validated['answer'],
                'data'      => [
                    'from_user_id'   => $answerer->id,
                    'from_user_name' => $answerer->fullname ?? $answerer->name ?? null,
                    'from_role'      => $answerer->role ?? null,
                    'course_title'   => optional($question->course)->title,
                    'question_id'    => $question->id,
                ],
            ]);
        }

        return response()->json($question);
    }

    /**
     * Admin: delete an answer (reset to unanswered).
     */
    public function adminDeleteAnswer(int $id)
    {
        $question = Question::findOrFail($id);

        $question->update([
            'answer'      => null,
            'answered_by' => null,
            'answered_at' => null,
        ]);

        $question->load(['user:id,fullname,department', 'course:id,title', 'answerer:id,fullname', 'replies.user:id,fullname,role', 'replies.reactions']);

        return response()->json($question);
    }

    /**
     * Admin: permanently delete a question and its replies.
     */
    public function adminDestroy(int $id)
    {
        $question = Question::with('replies:id,question_id')->findOrFail($id);

        // Collect reply IDs and delete associated reactions, then replies.
        $replyIds = $question->replies->pluck('id');
        if ($replyIds->isNotEmpty()) {
            QuestionReplyReaction::whereIn('reply_id', $replyIds)->delete();
            QuestionReply::whereIn('id', $replyIds)->delete();
        }

        $question->delete();

        return response()->json(['message' => 'Question deleted']);
    }

    /**
     * Post a reply to a question (works for any authenticated user).
     */
    public function storeReply(Request $request, int $id)
    {
        $question = Question::findOrFail($id);

        $validated = $request->validate([
            'message' => 'required|string|max:5000',
        ]);

        $reply = QuestionReply::create([
            'question_id' => $question->id,
            'user_id'     => $request->user()->id,
            'message'     => $validated['message'],
        ]);

        $reply->load('user:id,fullname,role');
        $reply->load('reactions');

        // Notify the original question owner when someone else replies
        $replier = $request->user();
        if ($question->user_id && $replier && $question->user_id !== $replier->id) {
            Notification::create([
                'user_id'   => $question->user_id,
                'course_id' => $question->course_id,
                'type'      => 'qa_reply',
                'title'     => 'New reply to your question',
                'message'   => $validated['message'],
                'data'      => [
                    'from_user_id'   => $replier->id,
                    'from_user_name' => $replier->fullname ?? $replier->name ?? null,
                    'from_role'      => $replier->role ?? null,
                    'course_title'   => optional($question->course)->title,
                    'question_id'    => $question->id,
                ],
            ]);
        }

        return response()->json($reply, 201);
    }

    /**
     * Delete a reply.
     */
    public function destroyReply(Request $request, int $questionId, int $replyId)
    {
        $reply = QuestionReply::where('id', $replyId)
            ->where('question_id', $questionId)
            ->firstOrFail();

        // Only the reply author or an admin can delete
        $user = $request->user();
        if ($reply->user_id !== $user->id && $user->role !== 'Admin') {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $reply->delete();

        return response()->json(['message' => 'Reply deleted']);
    }

    /**
     * Toggle an emoji reaction on a reply (adds if not present, removes if already reacted).
     */
    public function toggleReaction(Request $request, int $questionId, int $replyId)
    {
        $validated = $request->validate(['emoji' => 'required|string|max:10']);

        QuestionReply::where('id', $replyId)
            ->where('question_id', $questionId)
            ->firstOrFail();

        $existing = QuestionReplyReaction::where([
            'reply_id' => $replyId,
            'user_id'  => $request->user()->id,
            'emoji'    => $validated['emoji'],
        ])->first();

        if ($existing) {
            $existing->delete();
        } else {
            QuestionReplyReaction::create([
                'reply_id' => $replyId,
                'user_id'  => $request->user()->id,
                'emoji'    => $validated['emoji'],
            ]);
        }

        $reactions = QuestionReplyReaction::where('reply_id', $replyId)->get();

        return response()->json($reactions);
    }

    /**
     * Admin: get all lessons for Q&A dropdown.
     */
    public function adminLessons()
    {
        $lessons = Lesson::with('module:id,title,course_id', 'module.course:id,title')
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
     * Instructor: get lessons from courses they teach.
     */
    public function instructorLessons(Request $request)
    {
        $instructorId = $request->user()->id;

        $courseIds = Course::where('instructor_id', $instructorId)->pluck('id');

        $lessons = Lesson::whereHas('module', function ($q) use ($courseIds) {
            $q->whereIn('course_id', $courseIds);
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
     * Employee: get lessons only from courses they are enrolled in.
     */
    public function employeeLessons(Request $request)
    {
        $userId = $request->user()->id;

        // Get course IDs from the user's enrollments
        $courseIds = Enrollment::where('user_id', $userId)->pluck('course_id');

        $lessons = Lesson::whereHas('module', function ($q) use ($courseIds) {
            $q->whereIn('course_id', $courseIds);
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
}
