<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\Hash;
use App\Models\User;

$primary = [
    ['role' => 'admin', 'email' => 'admin@maptech.com', 'password' => 'admin123'],
    ['role' => 'instructor', 'email' => 'instructor@maptech.com', 'password' => 'instructor123'],
    ['role' => 'employee', 'email' => 'employee@maptech.com', 'password' => 'emp123'],
];

$out = __DIR__ . '/../primary_credentials.csv';
$rows = [];
foreach ($primary as $p) {
    $email = $p['email'];
    $role = $p['role'];
    $pw = $p['password'];

    // find existing case-insensitive
    $user = User::withTrashed()->whereRaw('LOWER(email) = ?', [strtolower($email)])->first();
    if ($user) {
        $user->password = Hash::make($pw);
        $user->role = $role;
        $user->status = 'Active';
        if (empty($user->fullname)) $user->fullname = ucfirst($role);
        $user->save();
    } else {
        $user = User::create([
            'fullname' => ucfirst($role),
            'email' => $email,
            'password' => Hash::make($pw),
            'role' => $role,
            'status' => 'Active',
        ]);
    }
    $rows[] = [$role, $email, $pw];
}

$fp = fopen($out,'w');
fputcsv($fp, ['role','email','password']);
foreach ($rows as $r) fputcsv($fp,$r);
fclose($fp);

echo "Created/updated " . count($rows) . " primary users and saved to primary_credentials.csv\n";
