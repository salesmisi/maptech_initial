<?php

namespace App\Http\Controllers;

use App\Models\Question;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class QAController extends Controller
{
    /**
     * Get questions.
     * - Admin/Instructor: all questions with asker + answerer info
     * - Employee: only their own questions
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $role = strtolower($user->role);

        $query = Question::with(['user:id,fullName,department', 'answeredBy:id,fullName,role'])
            ->orderBy('created_at', 'desc');

        if ($role === 'employee') {
            $query->where('user_id', $user->id);
        }

        $questions = $query->get()->map(function ($q) {
            return [
                'id'             => $q->id,
                'course'         => $q->course,
                'department'     => $q->department ?? $q->user?->department,
                'question'       => $q->question,
                'answer'         => $q->answer,
                'asked_by'       => $q->user?->fullName,
                'asked_by_id'    => $q->user_id,
                'answered_by'    => $q->answeredBy?->fullName,
                'answered_by_id' => $q->answered_by_id,
                'answered_at'    => $q->answered_at?->diffForHumans(),
                'created_at'     => $q->created_at->diffForHumans(),
            ];
        });

        return response()->json($questions);
    }

    /**
     * Employee asks a question.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'course'   => 'required|string|max:255',
            'question' => 'required|string|max:2000',
        ]);

        $user = $request->user();

        $question = Question::create([
            'user_id'    => $user->id,
            'course'     => $validated['course'],
            'department' => $user->department,
            'question'   => $validated['question'],
        ]);

        $question->load(['user:id,fullName,department', 'answeredBy:id,fullName,role']);

        return response()->json([
            'id'             => $question->id,
            'course'         => $question->course,
            'department'     => $question->department,
            'question'       => $question->question,
            'answer'         => null,
            'asked_by'       => $question->user?->fullName,
            'asked_by_id'    => $question->user_id,
            'answered_by'    => null,
            'answered_by_id' => null,
            'answered_at'    => null,
            'created_at'     => $question->created_at->diffForHumans(),
        ], 201);
    }

    /**
     * Employee edits their own question (only if unanswered).
     */
    public function update(Request $request, int $id)
    {
        $question = Question::findOrFail($id);
        $user = $request->user();

        if ($question->user_id !== $user->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($question->answer) {
            return response()->json(['message' => 'Cannot edit an already answered question'], 422);
        }

        $validated = $request->validate([
            'question' => 'required|string|max:2000',
        ]);

        $question->update(['question' => $validated['question']]);

        return response()->json(['message' => 'Question updated', 'question' => $question->question]);
    }

    /**
     * Employee deletes their own question (only if unanswered).
     * Admin can delete any question.
     */
    public function destroy(Request $request, int $id)
    {
        $question = Question::findOrFail($id);
        $user = $request->user();
        $role = strtolower($user->role);

        if ($role !== 'admin' && $question->user_id !== $user->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        if ($role === 'employee' && $question->answer) {
            return response()->json(['message' => 'Cannot delete an already answered question'], 422);
        }

        $question->delete();

        return response()->json(['message' => 'Question deleted']);
    }

    /**
     * Instructor or Admin posts/updates an answer.
     */
    public function answer(Request $request, int $id)
    {
        $question = Question::findOrFail($id);
        $user = $request->user();

        $validated = $request->validate([
            'answer' => 'required|string|max:5000',
        ]);

        $question->update([
            'answer'         => $validated['answer'],
            'answered_by_id' => $user->id,
            'answered_at'    => now(),
        ]);

        $question->load('answeredBy:id,fullName,role');

        return response()->json([
            'message'     => 'Answer posted',
            'answer'      => $question->answer,
            'answered_by' => $question->answeredBy?->fullName,
            'answered_at' => $question->answered_at->diffForHumans(),
        ]);
    }

    /**
     * Instructor or Admin removes their answer.
     */
    public function deleteAnswer(Request $request, int $id)
    {
        $question = Question::findOrFail($id);
        $user = $request->user();
        $role = strtolower($user->role);

        if ($role !== 'admin' && $question->answered_by_id !== $user->id) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $question->update([
            'answer'         => null,
            'answered_by_id' => null,
            'answered_at'    => null,
        ]);

        return response()->json(['message' => 'Answer removed']);
    }
}
