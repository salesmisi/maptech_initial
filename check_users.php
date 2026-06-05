<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

$users = App\Models\User::all();

foreach ($users as $user) {
    echo $user->id . ' | ' . $user->fullname . ' | ' . $user->role . ' | ' . ($user->department ?? 'NULL') . "\n";
}
