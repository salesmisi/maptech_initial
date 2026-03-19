<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Carbon;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Support\Facades\DB;

$uid = 1;
$user = User::find($uid);
if (!$user) {
    echo json_encode(['error' => 'user not found']);
    exit(1);
}

$logs = AuditLog::where('user_id', $user->id)
    ->with('user:id,fullname,email,role,department')
    ->orderByDesc('created_at')
    ->get();

$logs = $logs->map(function ($log) {
    $timeLog = null;
    if ($log->created_at) {
        $start = $log->created_at->copy()->subMinutes(2);
        $end = $log->created_at->copy()->addMinutes(2);
        if ($log->action === 'login') {
            $timeLog = \App\Models\TimeLog::where('user_id', $log->user_id)
                ->whereBetween('time_in', [$start, $end])
                ->orderBy('time_in')
                ->first();
        } elseif ($log->action === 'logout') {
            $timeLog = \App\Models\TimeLog::where('user_id', $log->user_id)
                ->whereBetween('time_out', [$start, $end])
                ->orderBy('time_out')
                ->first();
        }
    }
    $log->time_log = $timeLog;
    return $log;
});

$data = $logs->map(function ($log) {
    return [
        'id' => $log->id,
        'user_id' => $log->user_id,
        'action' => $log->action,
        'ip_address' => $log->ip_address,
        'created_at' => optional($log->created_at)->toIso8601String(),
        'updated_at' => optional($log->updated_at)->toIso8601String(),
        'time_log' => $log->time_log ? [
            'id' => $log->time_log->id,
            'time_in' => $log->time_log->time_in ? Carbon::parse($log->time_log->time_in)->toIso8601String() : null,
            'time_out' => $log->time_log->time_out ? Carbon::parse($log->time_log->time_out)->toIso8601String() : null,
        ] : null,
    ];
});

echo json_encode(['data' => $data], JSON_PRETTY_PRINT) . PHP_EOL;
