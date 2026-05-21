<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\Hash;
use App\Models\User;

$inputCsv = __DIR__ . '/../generated_users_readable.csv';
$outputCsv = __DIR__ . '/../generated_users_readable.csv';
if (!file_exists($inputCsv)) { echo "Input CSV not found: $inputCsv\n"; exit(1); }

$fp = fopen($inputCsv, 'r');
$headers = fgetcsv($fp);
$rows = [];
while (($r = fgetcsv($fp)) !== false) {
    $rows[] = $r;
}
fclose($fp);

$rolePasswords = [
    'admin' => 'admin123',
    'instructor' => 'instructor123',
    'employee' => 'emp123',
];

foreach ($rows as &$r) {
    // module_id,module_name,role,email,password
    $role = strtolower(trim($r[2]));
    $email = $r[3];
    if (isset($rolePasswords[$role])) {
        $newpw = $rolePasswords[$role];
        // update DB user password
        $user = User::withTrashed()->where('email', $email)->first();
        if ($user) {
            $user->password = Hash::make($newpw);
            $user->status = 'Active';
            $user->save();
        }
        $r[4] = $newpw;
    }
}

// write back CSV
$outfp = fopen($outputCsv, 'w');
if (!$outfp) { echo "Cannot open output CSV for writing: $outputCsv\n"; exit(1); }
fputcsv($outfp, $headers);
foreach ($rows as $r) fputcsv($outfp, $r);
fclose($outfp);

echo "Updated passwords for " . count($rows) . " users to role-based values and refreshed $outputCsv\n";
