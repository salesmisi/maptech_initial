<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

$rows = DB::table('notifications')->orderByDesc('created_at')->limit(10)->get();
echo "Total sample rows: " . count($rows) . "\n";
foreach ($rows as $r) {
    echo json_encode($r) . "\n";
}
