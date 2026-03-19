<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Carbon;
use App\Models\AuditLog;
use Illuminate\Support\Facades\DB;

$uid = 1;
$now = Carbon::now()->utc();

$login = AuditLog::create([
    'user_id' => $uid,
    'action' => 'login',
    'ip_address' => '127.0.0.1',
    'created_at' => $now,
]);
event(new App\Events\AuditLogCreated($login));

// small pause
sleep(1);

$logoutAt = Carbon::now()->utc()->addMinutes(1);
$logout = AuditLog::create([
    'user_id' => $uid,
    'action' => 'logout',
    'ip_address' => '127.0.0.1',
    'created_at' => $logoutAt,
]);
event(new App\Events\AuditLogCreated($logout));

// Fetch recent rows for verification
$als = DB::table('audit_logs')->where('user_id', $uid)->orderByDesc('id')->limit(10)->get();
print_r($als->toArray());

$tls = DB::table('time_logs')->where('user_id', $uid)->orderByDesc('id')->limit(10)->get();
print_r($tls->toArray());

echo "__DONE__\n";
