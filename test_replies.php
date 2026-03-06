<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(\Illuminate\Contracts\Http\Kernel::class);
$kernel->bootstrap();

// Check if question_replies table exists
echo 'Table exists: ' . (\Illuminate\Support\Facades\Schema::hasTable('question_replies') ? 'YES' : 'NO') . PHP_EOL;

// Check questions
$questions = \App\Models\Question::with('replies.user')->get();
echo 'Questions: ' . $questions->count() . PHP_EOL;
foreach ($questions as $q) {
    echo '  Q#' . $q->id . ': ' . substr($q->question, 0, 50) . ' | Replies: ' . $q->replies->count() . PHP_EOL;
}

// Check User model has 'role' column
$user = \App\Models\User::find(1);
echo 'Admin user role: ' . ($user->role ?? 'NULL') . PHP_EOL;
echo 'Admin user fullName: ' . ($user->fullName ?? 'NULL') . PHP_EOL;

// Try creating a reply
try {
    $reply = \App\Models\QuestionReply::create([
        'question_id' => 1,
        'user_id' => 1,
        'message' => 'Test admin reply from script',
    ]);
    echo 'Reply created: #' . $reply->id . PHP_EOL;
    $reply->load('user:id,fullName,role');
    echo 'Reply user JSON: ' . json_encode($reply->user) . PHP_EOL;
} catch (\Exception $e) {
    echo 'ERROR creating reply: ' . $e->getMessage() . PHP_EOL;
}

// Now test loading questions with replies
$q = \App\Models\Question::with(['replies.user:id,fullName,role'])->find(1);
echo PHP_EOL . 'Question #1 with replies JSON:' . PHP_EOL;
echo json_encode($q->toArray(), JSON_PRETTY_PRINT) . PHP_EOL;
