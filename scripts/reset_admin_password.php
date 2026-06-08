<?php
require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use Illuminate\Support\Facades\Hash;

$email = 'admin@local.test';
$password = 'Password123!';

$user = User::where('email', $email)->first();
if (! $user) {
    echo "NOT_FOUND\n";
    exit(2);
}

$user->password = Hash::make($password);
$user->save();

echo "UPDATED\n";
