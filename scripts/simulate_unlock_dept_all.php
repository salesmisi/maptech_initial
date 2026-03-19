<?php
// Simulate calling the new endpoint logic locally without HTTP
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Course;
use App\Models\User;
use Illuminate\Support\Facades\DB;

$courseId = $argv[1] ?? null;
$department = $argv[2] ?? 'IT';
$duration = isset($argv[3]) ? (int)$argv[3] : null; // minutes

if (!$courseId) { echo "Usage: php simulate_unlock_dept_all.php <courseId> [department] [duration_minutes]\n"; exit(1); }

$course = Course::with('modules')->find($courseId);
if (!$course) { echo "Course not found\n"; exit(1); }

$moduleIds = $course->modules->pluck('id')->toArray();
$userIds = $course->enrollments()->whereHas('user', function ($q) use ($department) {
    $q->where('department', $department);
})->pluck('user_id')->toArray();

$payload = ['unlocked' => true, 'unlocked_at' => now(), 'updated_at' => now(), 'created_at' => now()];
if ($duration) { $payload['unlocked_until'] = now()->addMinutes($duration); }

$count = 0;
foreach ($moduleIds as $mid) {
    foreach ($userIds as $uid) {
        DB::table('module_user')->updateOrInsert(['module_id'=>$mid,'user_id'=>$uid], $payload);
        $count++;
    }
}

echo "Unlocked {$count} module-user entries for department {$department}\n";
