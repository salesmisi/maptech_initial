<?php
/**
 * Script to fix incorrect quiz answers in the database.
 *
 * The following questions have wrong answers marked as correct:
 * 1. "What is cybersecurity?" - should be "Protecting systems, networks, and data"
 * 2. "What does a computer do?" - should be "Processes data"
 * 3. "What is a network?" - should be "Connected devices sharing data"
 * 4. "What is data?" - should be "Information"
 * 5. "Which is an example of malware?" - need to check options (Keyboard is wrong)
 *
 * Run with: php scripts/fix_quiz_answers.php
 */

require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\QuizQuestion;
use App\Models\QuizOption;
use Illuminate\Support\Facades\DB;

// Corrections mapping: question text => correct answer text
$corrections = [
    'What is cybersecurity?' => 'Protecting systems, networks, and data',
    'What does a computer do?' => 'Processes data',
    'What is a network?' => 'Connected devices sharing data',
    'What is data?' => 'Information',
    'Which is an example of malware?' => null, // We'll need to check available options
];

echo "Starting quiz answer corrections...\n\n";

DB::beginTransaction();

try {
    foreach ($corrections as $questionText => $correctAnswerText) {
        // Find the question (case-insensitive partial match)
        $question = QuizQuestion::where('question_text', 'LIKE', "%{$questionText}%")->first();

        if (!$question) {
            echo "⚠️  Question not found: '{$questionText}'\n";
            continue;
        }

        echo "📝 Question #{$question->id}: {$question->question_text}\n";

        // Get all options for this question
        $options = QuizOption::where('question_id', $question->id)->get();

        echo "   Options:\n";
        foreach ($options as $opt) {
            $marker = $opt->is_correct ? '✓ (currently marked correct)' : '';
            echo "   - [{$opt->id}] {$opt->option_text} {$marker}\n";
        }

        if ($correctAnswerText === null) {
            // For malware question, look for common malware examples
            $malwareKeywords = ['virus', 'trojan', 'worm', 'ransomware', 'spyware', 'malware'];
            $correctOption = null;

            foreach ($options as $opt) {
                foreach ($malwareKeywords as $keyword) {
                    if (stripos($opt->option_text, $keyword) !== false) {
                        $correctOption = $opt;
                        break 2;
                    }
                }
            }

            if (!$correctOption) {
                echo "   ⚠️  Could not determine correct answer for malware question. Please check manually.\n";
                continue;
            }

            $correctAnswerText = $correctOption->option_text;
        }

        // Find the option that should be correct
        $correctOption = $options->first(function($opt) use ($correctAnswerText) {
            return stripos($opt->option_text, $correctAnswerText) !== false
                || stripos($correctAnswerText, $opt->option_text) !== false;
        });

        if (!$correctOption) {
            echo "   ⚠️  Correct answer option not found: '{$correctAnswerText}'\n";
            continue;
        }

        // Reset all options to not correct
        QuizOption::where('question_id', $question->id)->update(['is_correct' => false]);

        // Set the correct option
        $correctOption->is_correct = true;
        $correctOption->save();

        echo "   ✅ Fixed! Correct answer is now: {$correctOption->option_text}\n\n";
    }

    DB::commit();
    echo "\n🎉 All corrections applied successfully!\n";

} catch (Exception $e) {
    DB::rollBack();
    echo "\n❌ Error: " . $e->getMessage() . "\n";
    exit(1);
}
