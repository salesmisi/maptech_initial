<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Course;
use App\Models\User;
use App\Models\Enrollment;

$course = Course::first();
$user = User::first();

if (! $course || ! $user) {
    echo "missing course or user\n";
    exit(1);
}

$en = Enrollment::create([
    'user_id' => $user->id,
    'course_id' => $course->id,
    'status' => 'In Progress',
    'progress' => 0,
    'enrolled_at' => now(),
]);

echo "created: " . $en->id . "\n";
