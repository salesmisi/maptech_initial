<?php

namespace App\Http\Controllers\Employee;

use App\Http\Controllers\Controller;
use App\Models\Enrollment;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class QuizController extends Controller
{
    /**
     * GET /employee/quizzes/{quizId}
     * Return quiz with questions/options for taking — correct answers are NOT exposed.
     */
    public function show(Request $request, int $quizId)
    {
        $quiz = Quiz::with(['questions.options', 'module'])->findOrFail($quizId);

        // Verify the employee is enrolled in this course
        $enrolled = Enrollment::where('user_id', $request->user()->id)
            ->where('course_id', $quiz->course_id)
            ->exists();

        if (!$enrolled) {
            return response()->json(['message' => 'You are not enrolled in this course.'], 403);
        }

        // Include the best attempt so the UI knows if already passed
        $bestAttempt = QuizAttempt::where('user_id', $request->user()->id)
            ->where('quiz_id', $quizId)
            ->orderByDesc('percentage')
            ->first();

        return response()->json([
            'id'              => $quiz->id,
            'title'           => $quiz->title,
            'description'     => $quiz->description,
            'pass_percentage' => $quiz->pass_percentage,
            'module_id'       => $quiz->module_id,
            'module_title'    => $quiz->module?->title,
            'best_attempt'    => $bestAttempt ? [
                'score'           => $bestAttempt->score,
                'total_questions' => $bestAttempt->total_questions,
                'percentage'      => $bestAttempt->percentage,
                'passed'          => $bestAttempt->passed,
                'created_at'      => $bestAttempt->created_at,
            ] : null,
            'questions'       => $quiz->questions->map(fn($q) => [
                'id'            => $q->id,
                'question_text' => $q->question_text,
                'image_url'     => $q->image_path ? Storage::url($q->image_path) : null,
                'video_url'     => $q->video_path ? Storage::url($q->video_path) : null,
                'order'         => $q->order,
                'options'       => $q->options->map(fn($o) => [
                    'id'          => $o->id,
                    'option_text' => $o->option_text,
                    // is_correct is intentionally omitted
                ]),
            ])->values(),
        ]);
    }

    /**
     * POST /employee/quizzes/{quizId}/submit
     * Body: { answers: { "<question_id>": <option_id>, ... } }
     * Grades the attempt and returns the result.
     */
    public function submit(Request $request, int $quizId)
    {
        $quiz = Quiz::with('questions.options')->findOrFail($quizId);

        $enrolled = Enrollment::where('user_id', $request->user()->id)
            ->where('course_id', $quiz->course_id)
            ->exists();

        if (!$enrolled) {
            return response()->json(['message' => 'You are not enrolled in this course.'], 403);
        }

        $request->validate([
            'answers'   => 'required|array',
            'answers.*' => 'nullable|integer',   // option_id keyed by question_id
        ]);

        $answers = $request->answers; // [ "questionId" => optionId, ... ]
        $total   = $quiz->questions->count();
        $correct = 0;

        foreach ($quiz->questions as $question) {
            $selectedOptionId = $answers[$question->id] ?? null;
            if ($selectedOptionId !== null) {
                $correctOption = $question->options->firstWhere('is_correct', true);
                if ($correctOption && (int) $correctOption->id === (int) $selectedOptionId) {
                    $correct++;
                }
            }
        }

        $percentage = $total > 0 ? round(($correct / $total) * 100, 2) : 0;
        $passed     = $percentage >= $quiz->pass_percentage;

        QuizAttempt::create([
            'user_id'         => $request->user()->id,
            'quiz_id'         => $quizId,
            'score'           => $correct,
            'total_questions' => $total,
            'percentage'      => $percentage,
            'passed'          => $passed,
        ]);

        // ── Recalculate enrollment progress ────────────────────────────────
        Enrollment::recalculateProgress($request->user()->id, $quiz->course_id);

        return response()->json([
            'score'           => $correct,
            'total'           => $total,
            'percentage'      => $percentage,
            'passed'          => $passed,
            'pass_percentage' => $quiz->pass_percentage,
        ]);
    }

    /**
     * GET /employee/quizzes/{quizId}/attempts
     * Returns the current employee's attempt history for a quiz.
     */
    public function myAttempts(Request $request, int $quizId)
    {
        Quiz::findOrFail($quizId);

        $attempts = QuizAttempt::where('user_id', $request->user()->id)
            ->where('quiz_id', $quizId)
            ->latest()
            ->get()
            ->map(fn($a) => [
                'id'              => $a->id,
                'score'           => $a->score,
                'total_questions' => $a->total_questions,
                'percentage'      => $a->percentage,
                'passed'          => $a->passed,
                'created_at'      => $a->created_at,
            ]);

        return response()->json($attempts);
    }
}
