<?php
/**
 * Script to fix ALL incorrect quiz answers in the database.
 * Run with: php scripts/fix_all_quiz_answers.php
 */

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\QuizQuestion;
use App\Models\QuizOption;
use Illuminate\Support\Facades\DB;

// Comprehensive corrections mapping: question text => correct answer text
$corrections = [
    // Already fixed but including for completeness
    'What is cybersecurity?' => 'Protecting systems, networks, and data',
    'What does a computer do?' => 'Processes data',
    'What is a network?' => 'Connected devices sharing data',
    'What is data?' => 'Information',
    'Which is an example of malware?' => 'Virus',

    // New fixes
    'What is phishing?' => 'Fake message to steal information',
    'Which password is strong?' => 'G!aN2026_secure',
    'What is MFA?' => 'Multi-Factor Authentication',
    'Why is MFA important?' => 'It adds extra security',
    'What should you do with suspicious emails?' => 'Ignore or verify',
    'What is social engineering?' => 'Manipulating people for information',
    'What is a risk of public Wi-Fi?' => 'Data theft',
    'Why update software?' => 'To fix security issues',
    'What should you NOT share?' => 'Passwords',
    'What is ransomware?' => 'Malware that locks files for payment',
];

echo "Starting comprehensive quiz answer corrections...\n\n";

DB::beginTransaction();

$fixedCount = 0;
$alreadyCorrectCount = 0;
$notFoundCount = 0;

try {
    foreach ($corrections as $questionText => $correctAnswerText) {
        // Find the question (case-insensitive partial match)
        $question = QuizQuestion::where('question_text', 'LIKE', "%{$questionText}%")->first();

        if (!$question) {
            echo "⚠️  Question not found: '{$questionText}'\n";
            $notFoundCount++;
            continue;
        }

        // Get all options for this question
        $options = QuizOption::where('question_id', $question->id)->get();

        // Find the currently marked correct option
        $currentCorrect = $options->firstWhere('is_correct', true);

        // Find the option that should be correct
        $correctOption = $options->first(function($opt) use ($correctAnswerText) {
            return stripos($opt->option_text, $correctAnswerText) !== false;
        });

        if (!$correctOption) {
            echo "⚠️  Q#{$question->id}: '{$questionText}' - Correct answer option not found: '{$correctAnswerText}'\n";
            $notFoundCount++;
            continue;
        }

        // Check if already correct
        if ($correctOption->is_correct) {
            echo "✓  Q#{$question->id}: {$questionText} - Already correct\n";
            $alreadyCorrectCount++;
            continue;
        }

        // Reset all options to not correct
        QuizOption::where('question_id', $question->id)->update(['is_correct' => false]);

        // Set the correct option
        $correctOption->is_correct = true;
        $correctOption->save();

        $wasWrong = $currentCorrect ? $currentCorrect->option_text : 'none';
        echo "✅ Q#{$question->id}: {$questionText}\n";
        echo "   Changed from: {$wasWrong}\n";
        echo "   Changed to:   {$correctOption->option_text}\n\n";
        $fixedCount++;
    }

    DB::commit();

    echo "\n" . str_repeat("=", 50) . "\n";
    echo "Summary:\n";
    echo "  Fixed: {$fixedCount} questions\n";
    echo "  Already correct: {$alreadyCorrectCount} questions\n";
    echo "  Not found/issues: {$notFoundCount} questions\n";
    echo str_repeat("=", 50) . "\n";
    echo "\n🎉 All corrections applied successfully!\n";

} catch (Exception $e) {
    DB::rollBack();
    echo "\n❌ Error: " . $e->getMessage() . "\n";
    exit(1);
}
