<?php
if ($argc < 3) {
    echo "Usage: php auth_test.php email password\n";
    exit(2);
}
$email = $argv[1];
$password = $argv[2];
require __DIR__.'/../vendor/autoload.php';
$app = require_once __DIR__.'/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use Illuminate\Support\Facades\Hash;

$user = User::where('email', $email)->first();
if (! $user) {
    echo "NOT_FOUND\n";
    exit(3);
}

$ok = Hash::check($password, $user->password);
if ($ok) {
    echo "AUTH_OK: id={$user->id}, email={$user->email}, role={$user->role}\n";
    exit(0);
}

echo "AUTH_FAIL\n";
exit(4);
