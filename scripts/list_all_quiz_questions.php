<?php
/**
 * Script to list all quiz questions and their options.
 * Run with: php scripts/list_all_quiz_questions.php
 */

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\QuizQuestion;

$questions = QuizQuestion::with('options')->orderBy('id')->get();

foreach ($questions as $q) {
    echo "Q#{$q->id}: {$q->question_text}\n";
    foreach ($q->options as $o) {
        $mark = $o->is_correct ? ' [CORRECT]' : '';
        echo "  - [{$o->id}] {$o->option_text}{$mark}\n";
    }
    echo "\n";
}

echo "Total questions: " . $questions->count() . "\n";
