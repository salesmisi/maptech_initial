<?php

namespace App\Http\Controllers;

use App\Models\Question;
use App\Models\QuestionReply;
use App\Models\QuestionReplyReaction;
use App\Models\Course;
use Illuminate\Http\Request;

class QAController extends Controller
{
    /**
     * Employee: list own questions (with course, answerer, and replies).
     */
    public function employeeIndex(Request $request)
    {
        $questions = Question::where('user_id', $request->user()->id)
            ->with(['course:id,title', 'answerer:id,fullname', 'replies.user:id,fullname,role', 'replies.reactions'])
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
            'course_id' => 'required|exists:courses,id',
            'question'  => 'required|string|max:2000',
        ]);

        $question = Question::create([
            'user_id'   => $request->user()->id,
            'course_id' => $validated['course_id'],
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
            'user:id,fullname,department',
            'course:id,title',
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
                'user:id,fullname,department',
                'course:id,title',
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
            'answered_at' => now(),
        ]);

        $question->load(['user:id,fullname,department', 'course:id,title', 'answerer:id,fullname', 'replies.user:id,fullname,role', 'replies.reactions']);

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
}
