<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use App\Models\Module;
use App\Models\User;

$roles = ['admin','instructor','employee'];
$rows = [];
$modules = Module::all();
if ($modules->count() === 0) {
    echo "No modules found.\n";
    exit(0);
}

foreach ($modules as $m) {
    foreach ($roles as $r) {
        $email = sprintf('%s_module%d@maptech.com', $r, $m->id);
        // Generate a 12-character password with mixed chars
        $bytes = random_bytes(9);
        $password = substr(bin2hex($bytes), 0, 12);

        $user = User::withTrashed()->where('email', $email)->first();
        if ($user) {
            if (method_exists($user, 'restore') && $user->trashed()) {
                try { $user->restore(); } catch (\Exception $e) { /* ignore */ }
            }
            $user->password = Hash::make($password);
            $user->role = $r;
            $user->status = 'Active';
            if (empty($user->fullname)) {
                $user->fullname = ucfirst($r) . ' Module ' . $m->id;
            }
            $user->save();
        } else {
            $user = User::create([
                'fullname' => ucfirst($r) . ' Module ' . $m->id,
                'email' => $email,
                'password' => Hash::make($password),
                'role' => $r,
                'status' => 'Active',
            ]);
        }

        // Attach module via pivot if relation exists
        if (method_exists($user, 'modules')) {
            try { $user->modules()->syncWithoutDetaching([$m->id]); } catch (\Exception $e) { /* ignore */ }
        }

        $rows[] = [
            $m->id,
            isset($m->title) ? $m->title : (isset($m->name) ? $m->name : 'module_'.$m->id),
            $r,
            $email,
            $password,
        ];
    }
}

$fp = fopen(__DIR__ . '/../generated_users.csv', 'w');
if ($fp === false) {
    echo "Failed to open generated_users.csv for writing.\n";
    exit(1);
}

fputcsv($fp, ['module_id', 'module_name', 'role', 'email', 'password']);
foreach ($rows as $row) {
    fputcsv($fp, $row);
}
fclose($fp);

echo "Created " . count($rows) . " users. Credentials saved to generated_users.csv\n";
