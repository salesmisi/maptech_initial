<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use App\Models\TimeLog;
use App\Events\TimeLogUpdated;

$userId = 16; // Kurt Cabrera from screenshot
$user = User::find($userId);
if (!$user) {
    echo "User $userId not found\n";
    exit(1);
}

$timeLog = TimeLog::create([
    'user_id' => $user->id,
    'time_in' => now(),
    'note' => 'Seeded for UI delete test',
]);

echo "Seeded time log id={$timeLog->id} for user {$user->id} (no broadcast)\n";
