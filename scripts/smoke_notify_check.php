<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();
$count = \App\Models\Notification::where('user_id', 16)->whereNull('read_at')->count();
echo "UNREAD_COUNT:" . $count . PHP_EOL;
