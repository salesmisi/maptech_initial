<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Course;

$courses = Course::withCount('modules')->orderBy('created_at')->get();
foreach ($courses as $c) {
    echo $c->id . ' modules=' . $c->modules_count . PHP_EOL;
}
