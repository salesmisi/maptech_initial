<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\Hash;
use App\Models\User;

$in = __DIR__ . '/../generated_users.csv';
$out = __DIR__ . '/../generated_users_readable.csv';
if (!file_exists($in)) { echo "Input file not found: $in\n"; exit(1); }
$fp = fopen($in,'r');
$headers = fgetcsv($fp);
$rows = [];
while (($r = fgetcsv($fp)) !== false) {
    $rows[] = $r;
}
fclose($fp);

function gen_readable_password() {
    $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    $len = 12;
    $s = '';
    $max = strlen($chars)-1;
    for ($i=0;$i<$len;$i++) {
        $s .= $chars[random_int(0,$max)];
    }
    // split into 4-4-4 for readability
    return substr($s,0,4) . '-' . substr($s,4,4) . '-' . substr($s,8,4);
}

$outfp = fopen($out,'w');
if (!$outfp) { echo "Cannot open output file $out\n"; exit(1); }
fputcsv($outfp, $headers);

foreach ($rows as $r) {
    // columns: module_id,module_name,role,email,password
    $email = $r[3];
    $newpw = gen_readable_password();
    // update DB
    $user = User::withTrashed()->where('email',$email)->first();
    if ($user) {
        $user->password = Hash::make($newpw);
        $user->status = 'Active';
        $user->save();
    } else {
        // create minimal user record if missing
        $user = User::create([
            'fullname' => ucfirst($r[2]) . ' ' . $r[1],
            'email' => $email,
            'password' => Hash::make($newpw),
            'role' => $r[2],
            'status' => 'Active',
        ]);
    }
    $r[4] = $newpw;
    fputcsv($outfp, $r);
}
fclose($outfp);

echo "Updated " . count($rows) . " passwords and wrote to $out\n";
