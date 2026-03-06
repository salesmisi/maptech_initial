<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();
use Illuminate\Support\Facades\DB;
$rows = DB::select("SELECT conname, pg_get_constraintdef(c.oid) as def FROM pg_constraint c WHERE conname LIKE '%status%'");
foreach ($rows as $r) {
    echo $r->conname . ': ' . $r->def . PHP_EOL;
}
