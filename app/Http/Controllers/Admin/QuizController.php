<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\Module;
use App\Models\Quiz;
use App\Models\QuizQuestion;
use App\Models\QuizOption;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class QuizController extends Controller
{
    // ─── Quiz CRUD ────────────────────────────────────────────────────────────

    /** GET /admin/quizzes — all quizzes across all courses */
    public function index(Request $request)
    {
        $quizzes = Quiz::with(['course', 'module', 'questions'])
            ->latest()
            ->get()
            ->map(function ($quiz) {
                return [
                    'id'              => $quiz->id,
                    'title'           => $quiz->title,
                    'description'     => $quiz->description,
                    'pass_percentage' => $quiz->pass_percentage,
                    'course_id'       => $quiz->course_id,
                    'course_title'    => $quiz->course->title,
                    'course_dept'     => $quiz->course->department,
                    'module_id'       => $quiz->module_id,
                    'module_title'    => $quiz->module?->title,
                    'question_count'  => $quiz->questions->count(),
                    'created_at'      => $quiz->created_at,
                ];
            });

        return response()->json($quizzes);
    }

    /** GET /admin/courses/{courseId}/quizzes — quizzes for a specific course */
    public function forCourse(Request $request, string $courseId)
    {
        Course::findOrFail($courseId);

        $quizzes = Quiz::with(['questions', 'module'])
            ->where('course_id', $courseId)
            ->latest()
            ->get()
            ->map(fn($quiz) => [
                'id'              => $quiz->id,
                'title'           => $quiz->title,
                'description'     => $quiz->description,
                'pass_percentage' => $quiz->pass_percentage,
                'module_id'       => $quiz->module_id,
                'module_title'    => $quiz->module?->title,
                'question_count'  => $quiz->questions->count(),
                'created_at'      => $quiz->created_at,
            ]);

        return response()->json($quizzes);
    }

    /** GET /admin/modules/{moduleId}/quizzes — quiz attached to a specific module */
    public function forModule(Request $request, int $moduleId)
    {
        Module::findOrFail($moduleId);

        $quizzes = Quiz::with('questions')
            ->where('module_id', $moduleId)
            ->latest()
            ->get()
            ->map(fn($quiz) => [
                'id'              => $quiz->id,
                'title'           => $quiz->title,
                'description'     => $quiz->description,
                'pass_percentage' => $quiz->pass_percentage,
                'module_id'       => $quiz->module_id,
                'question_count'  => $quiz->questions->count(),
                'created_at'      => $quiz->created_at,
            ]);

        return response()->json($quizzes);
    }

    /** POST /admin/courses/{courseId}/quizzes — create quiz */
    public function store(Request $request, string $courseId)
    {
        Course::findOrFail($courseId);

        $validated = $request->validate([
            'title'           => 'required|string|max:255',
            'description'     => 'nullable|string',
            'module_id'       => 'nullable|integer|exists:modules,id',
            'pass_percentage' => 'nullable|integer|min:1|max:100',
        ]);

        $quiz = Quiz::create([
            'course_id'       => $courseId,
            'module_id'       => $validated['module_id'] ?? null,
            'title'           => $validated['title'],
            'description'     => $validated['description'] ?? null,
            'pass_percentage' => $validated['pass_percentage'] ?? 70,
        ]);

        return response()->json([
            'id'              => $quiz->id,
            'title'           => $quiz->title,
            'description'     => $quiz->description,
            'pass_percentage' => $quiz->pass_percentage,
            'course_id'       => $quiz->course_id,
            'module_id'       => $quiz->module_id,
            'question_count'  => 0,
            'created_at'      => $quiz->created_at,
        ], 201);
    }

    /** POST /admin/modules/{moduleId}/quizzes — create quiz directly under a module */
    public function storeForModule(Request $request, int $moduleId)
    {
        $module = Module::findOrFail($moduleId);

        if (Quiz::where('module_id', $moduleId)->exists()) {
            return response()->json(['message' => 'This module already has a quiz. Delete it first to create a new one.'], 422);
        }

        $validated = $request->validate([
            'title'           => 'required|string|max:255',
            'description'     => 'nullable|string',
            'pass_percentage' => 'nullable|integer|min:1|max:100',
        ]);

        $quiz = Quiz::create([
            'course_id'       => $module->course_id,
            'module_id'       => $moduleId,
            'title'           => $validated['title'],
            'description'     => $validated['description'] ?? null,
            'pass_percentage' => $validated['pass_percentage'] ?? 70,
        ]);

        return response()->json([
            'id'              => $quiz->id,
            'title'           => $quiz->title,
            'description'     => $quiz->description,
            'pass_percentage' => $quiz->pass_percentage,
            'course_id'       => $quiz->course_id,
            'module_id'       => $quiz->module_id,
            'question_count'  => 0,
            'created_at'      => $quiz->created_at,
        ], 201);
    }

    /** GET /admin/quizzes/{id} — quiz detail with questions & options */
    public function show(Request $request, int $id)
    {
        $quiz = Quiz::with(['course', 'module', 'questions.options'])->findOrFail($id);

        return response()->json([
            'id'              => $quiz->id,
            'title'           => $quiz->title,
            'description'     => $quiz->description,
            'pass_percentage' => $quiz->pass_percentage,
            'course_id'       => $quiz->course_id,
            'course_title'    => $quiz->course->title,
            'module_id'       => $quiz->module_id,
            'module_title'    => $quiz->module?->title,
            'questions'       => $quiz->questions->map(fn($q) => $this->formatQuestion($q))->values(),
            'created_at'      => $quiz->created_at,
        ]);
    }

    /** PUT /admin/quizzes/{id} — update quiz metadata */
    public function update(Request $request, int $id)
    {
        $quiz = Quiz::findOrFail($id);

        $validated = $request->validate([
            'title'           => 'required|string|max:255',
            'description'     => 'nullable|string',
            'pass_percentage' => 'nullable|integer|min:1|max:100',
        ]);

        $quiz->update($validated);

        return response()->json(['message' => 'Quiz updated.', 'quiz' => $quiz]);
    }

    /** DELETE /admin/quizzes/{id} */
    public function destroy(Request $request, int $id)
    {
        $quiz = Quiz::with('questions')->findOrFail($id);

        foreach ($quiz->questions as $question) {
            if ($question->image_path) Storage::disk('public')->delete($question->image_path);
            if ($question->video_path) Storage::disk('public')->delete($question->video_path);
        }

        $quiz->delete();

        return response()->json(['message' => 'Quiz deleted.']);
    }

    // ─── Question CRUD ────────────────────────────────────────────────────────

    /** POST /admin/quizzes/{quizId}/questions */
    public function addQuestion(Request $request, int $quizId)
    {
        $quiz = Quiz::findOrFail($quizId);

        $request->validate([
            'question_text'          => 'required|string',
            'options'                => 'required|array|min:2',
            'options.*.text'         => 'required|string',
            'options.*.is_correct'   => 'required|boolean',
            'image'                  => 'nullable|file|mimes:jpg,jpeg,png,gif,webp|max:10240',
            'video'                  => 'nullable|file|mimes:mp4,webm,ogg,mov|max:102400',
        ]);

        $order = $quiz->questions()->max('order') + 1;

        $imagePath = null;
        $videoPath  = null;

        if ($request->hasFile('image')) {
            $imagePath = $request->file('image')->store('quiz-media/images', 'public');
        }
        if ($request->hasFile('video')) {
            $videoPath = $request->file('video')->store('quiz-media/videos', 'public');
        }

        $question = QuizQuestion::create([
            'quiz_id'       => $quizId,
            'question_text' => $request->question_text,
            'image_path'    => $imagePath,
            'video_path'    => $videoPath,
            'order'         => $order,
        ]);

        foreach ($request->options as $idx => $opt) {
            QuizOption::create([
                'question_id' => $question->id,
                'option_text' => $opt['text'],
                'is_correct'  => (bool) $opt['is_correct'],
                'order'       => $idx,
            ]);
        }

        $question->load('options');

        return response()->json($this->formatQuestion($question), 201);
    }

    /** PUT /admin/quizzes/{quizId}/questions/{questionId} */
    public function updateQuestion(Request $request, int $quizId, int $questionId)
    {
        Quiz::findOrFail($quizId);
        $question = QuizQuestion::where('quiz_id', $quizId)->findOrFail($questionId);

        $request->validate([
            'question_text'        => 'required|string',
            'options'              => 'required|array|min:2',
            'options.*.text'       => 'required|string',
            'options.*.is_correct' => 'required|boolean',
            'image'                => 'nullable|file|mimes:jpg,jpeg,png,gif,webp|max:10240',
            'video'                => 'nullable|file|mimes:mp4,webm,ogg,mov|max:102400',
            'remove_image'         => 'nullable|boolean',
            'remove_video'         => 'nullable|boolean',
        ]);

        $imagePath = $question->image_path;
        $videoPath  = $question->video_path;

        if ($request->boolean('remove_image') && $imagePath) {
            Storage::disk('public')->delete($imagePath);
            $imagePath = null;
        }
        if ($request->boolean('remove_video') && $videoPath) {
            Storage::disk('public')->delete($videoPath);
            $videoPath = null;
        }
        if ($request->hasFile('image')) {
            if ($imagePath) Storage::disk('public')->delete($imagePath);
            $imagePath = $request->file('image')->store('quiz-media/images', 'public');
        }
        if ($request->hasFile('video')) {
            if ($videoPath) Storage::disk('public')->delete($videoPath);
            $videoPath = $request->file('video')->store('quiz-media/videos', 'public');
        }

        $question->update([
            'question_text' => $request->question_text,
            'image_path'    => $imagePath,
            'video_path'    => $videoPath,
        ]);

        $question->options()->delete();
        foreach ($request->options as $idx => $opt) {
            QuizOption::create([
                'question_id' => $question->id,
                'option_text' => $opt['text'],
                'is_correct'  => (bool) $opt['is_correct'],
                'order'       => $idx,
            ]);
        }

        $question->load('options');

        return response()->json($this->formatQuestion($question));
    }

    /** DELETE /admin/quizzes/{quizId}/questions/{questionId} */
    public function deleteQuestion(Request $request, int $quizId, int $questionId)
    {
        Quiz::findOrFail($quizId);
        $question = QuizQuestion::where('quiz_id', $quizId)->findOrFail($questionId);

        if ($question->image_path) Storage::disk('public')->delete($question->image_path);
        if ($question->video_path) Storage::disk('public')->delete($question->video_path);

        $question->delete();

        return response()->json(['message' => 'Question deleted.']);
    }

    // ─── Format helper ────────────────────────────────────────────────────────

    private function formatQuestion(QuizQuestion $q): array
    {
        return [
            'id'            => $q->id,
            'question_text' => $q->question_text,
            'image_url'     => $q->image_path ? Storage::url($q->image_path) : null,
            'video_url'     => $q->video_path ? Storage::url($q->video_path) : null,
            'image_path'    => $q->image_path,
            'video_path'    => $q->video_path,
            'order'         => $q->order,
            'options'       => $q->options->map(fn($o) => [
                'id'          => $o->id,
                'option_text' => $o->option_text,
                'is_correct'  => $o->is_correct,
                'order'       => $o->order,
            ]),
        ];
    }
}
