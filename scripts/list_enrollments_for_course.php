<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Course;

$courseId = $argv[1] ?? null;
if (!$courseId) { echo "Usage: php list_enrollments_for_course.php <courseId>\n"; exit(1); }

$c = Course::with('enrollments.user')->find($courseId);
if (!$c) { echo "course not found\n"; exit(1); }

foreach ($c->enrollments as $e) {
    echo ($e->user?->id ?? 'unknown') . ' ' . ($e->user?->fullname ?? 'unknown') . ' ' . ($e->user?->department ?? 'unknown') . PHP_EOL;
}
