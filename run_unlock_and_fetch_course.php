<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Carbon;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Module;
use App\Models\Quiz;
use App\Models\QuizAttempt;
use App\Models\CourseEnrollment;
use App\Models\User;
use Illuminate\Support\Facades\DB;

$uid = $argv[1] ?? 1;
$user = User::find($uid);
if (!$user) {
    echo json_encode(['error' => 'user not found', 'user_id' => $uid]) . PHP_EOL;
    exit(1);
}

// Ensure the user is enrolled in a course; pick first active course if none
$enrollment = Enrollment::where('user_id', $user->id)->first();
if (!$enrollment) {
    // Prefer a course that has modules
    $course = Course::whereHas('modules')->active()->first() ?? Course::active()->first();
    if (!$course) {
        echo json_encode(['error' => 'no active course found']) . PHP_EOL;
        exit(1);
    }
    $enrollment = Enrollment::create([
        'user_id' => $user->id,
        'course_id' => $course->id,
        'progress' => 0,
        'enrolled_at' => now(),
    ]);
}

$courseId = $enrollment->course_id;
$course = Course::with([ 'instructor:id,fullname,email', 'modules' => fn($q) => $q->with('lessons')->orderBy('order')->orderBy('id') ])->find($courseId);
// If the enrolled course has no modules, try to find another course with modules and enroll there
if ($course && $course->modules->isEmpty()) {
    $alt = Course::whereHas('modules')->active()->first();
    if ($alt) {
        $enrollment->course_id = $alt->id;
        $enrollment->save();
        $course = Course::with([ 'instructor:id,fullname,email', 'modules' => fn($q) => $q->with('lessons')->orderBy('order')->orderBy('id') ])->find($alt->id);
    }
}
if (!$course) {
    echo json_encode(['error' => 'course not found', 'course_id' => $courseId]) . PHP_EOL;
    exit(1);
}

// Unlock enrollment (instructor action)
$enrollmentRecord = Enrollment::where('user_id', $user->id)->where('course_id', $course->id)->first();
if ($enrollmentRecord) {
    $enrollmentRecord->locked = false;
    $enrollmentRecord->save();
}

// Unlock first module for the user (simulate ModuleUnlocked)
$firstModule = $course->modules->first();
if ($firstModule) {
    DB::table('module_user')->updateOrInsert(
        ['module_id' => $firstModule->id, 'user_id' => $user->id],
        ['unlocked' => true, 'unlocked_at' => now(), 'updated_at' => now(), 'created_at' => now()]
    );
}

// Now replicate the employee controller logic to build the course payload
// Load module IDs
$moduleIds = $course->modules->pluck('id');

// manual unlocked modules for user
$manualUnlockedModuleIds = DB::table('module_user')
    ->where('user_id', $user->id)
    ->whereIn('module_id', $moduleIds)
    ->where('unlocked', true)
    ->pluck('module_id')
    ->map(fn($id) => (string)$id)
    ->toArray();

// Prevent access if enrollment locked and no manual unlocks
if ($enrollmentRecord && ($enrollmentRecord->locked ?? false)) {
    if (empty($manualUnlockedModuleIds)) {
        echo json_encode(['error' => 'This course has been locked by the instructor.'], JSON_PRETTY_PRINT) . PHP_EOL;
        exit(0);
    }
}

// quizzes
$quizByModule = Quiz::whereIn('module_id', $moduleIds)
    ->withCount('questions')
    ->get()
    ->keyBy('module_id');

$quizIds = $quizByModule->pluck('id');

$passedQuizIds = QuizAttempt::where('user_id', $user->id)
    ->whereIn('quiz_id', $quizIds)
    ->where('passed', true)
    ->pluck('quiz_id')
    ->flip();

$bestAttempts = QuizAttempt::where('user_id', $user->id)
    ->whereIn('quiz_id', $quizIds)
    ->orderByDesc('percentage')
    ->get()
    ->unique('quiz_id')
    ->keyBy('quiz_id');

$previousUnlocked = true;

$modules = $course->modules->map(function ($mod) use (&$previousUnlocked, $quizByModule, $passedQuizIds, $bestAttempts, $manualUnlockedModuleIds) {
    $isUnlocked = $previousUnlocked;
    if (in_array((string) $mod->id, $manualUnlockedModuleIds, true)) {
        $isUnlocked = true;
    }
    $quiz = $quizByModule->get($mod->id);
    if ($quiz) {
        $hasPassed = isset($passedQuizIds[$quiz->id]);
        $previousUnlocked = $hasPassed;
        $best = $bestAttempts->get($quiz->id);
        $quizData = [
            'id' => $quiz->id,
            'title' => $quiz->title,
            'description' => $quiz->description,
            'pass_percentage' => $quiz->pass_percentage,
            'question_count' => $quiz->questions_count,
            'has_passed' => $hasPassed,
            'best_attempt' => $best ? [
                'score' => $best->score,
                'total_questions' => $best->total_questions,
                'percentage' => (float) $best->percentage,
                'passed' => $best->passed,
                'created_at' => $best->created_at,
            ] : null,
        ];
    } else {
        $quizData = null;
    }

    return [
        'id' => $mod->id,
        'title' => $mod->title,
        'content_path' => $mod->content_path,
        'content_url' => $mod->content_url,
        'file_type' => $mod->file_type,
        'order' => $mod->order,
        'created_at' => $mod->created_at,
        'lessons' => $mod->lessons->map(fn($l) => [
            'id' => $l->id,
            'title' => $l->title,
            'text_content' => $l->text_content,
            'content_path' => $l->content_path,
            'content_url' => $l->content_url,
            'file_type' => $l->file_type,
            'order' => $l->order,
        ]),
        'quiz' => $quizData,
        'is_unlocked' => $isUnlocked,
    ];
});

$output = [
    'id' => $course->id,
    'title' => $course->title,
    'description' => $course->description,
    'department' => $course->department,
    'status' => $course->status,
    'deadline' => $course->deadline?->toISOString(),
    'instructor' => $course->instructor ? [
        'id' => $course->instructor->id,
        'fullName' => $course->instructor->fullname,
        'email' => $course->instructor->email,
    ] : null,
    'modules' => $modules->values(),
    'manual_unlocked_module_ids' => $manualUnlockedModuleIds,
];

echo json_encode($output, JSON_PRETTY_PRINT) . PHP_EOL;
