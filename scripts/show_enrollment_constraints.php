<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

$rows = DB::select("SELECT conname, pg_get_constraintdef(c.oid) AS def\nFROM pg_constraint c\nJOIN pg_class t ON c.conrelid = t.oid\nWHERE t.relname = 'enrollments';");

foreach ($rows as $r) {
    echo $r->conname . " => " . $r->def . "\n";
}
