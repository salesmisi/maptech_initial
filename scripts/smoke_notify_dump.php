<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();
$notif = \App\Models\Notification::where('user_id', 16)->orderByDesc('id')->first();
if (!$notif) { echo "NO_NOTIFICATION\n"; exit(0); }
$output = $notif->toArray();
$output['created_at'] = optional($notif->created_at)->toIso8601String();
$output['read_at'] = optional($notif->read_at)->toIso8601String();
echo json_encode($output, JSON_PRETTY_PRINT) . PHP_EOL;
