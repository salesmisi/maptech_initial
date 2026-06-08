<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;

$email = 'admin@test.com';
$user = User::where('email', $email)->first();
if (! $user) {
    echo "User not found: $email\n";
    exit(1);
}

$token = $user->createToken('cli-test-token')->plainTextToken;
echo "TOKEN:" . $token . "\n";
// Also write token to a file for test scripts
@file_put_contents(__DIR__ . '/last_token.txt', $token);
