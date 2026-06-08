<?php
require __DIR__ . '/../vendor/autoload.php';
// Bootstrap the framework
$app = require __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use Illuminate\Http\Request;

$admin = User::where('role', 'Admin')->first();
if (!$admin) {
    echo "No admin user found\n";
    exit(1);
}
$logId = 1; // target id

$request = Request::create('/', 'DELETE');
$request->setUserResolver(function () use ($admin) { return $admin; });

// Call controller
/** @var \App\Http\Controllers\TimeLogController $ctrl */
$ctrl = app(\App\Http\Controllers\TimeLogController::class);
$response = $ctrl->deleteLog($request, $logId);

if (is_object($response) && method_exists($response, 'getStatusCode')) {
    echo "Deleted via controller. HTTP status: " . $response->getStatusCode() . "\n";
} else {
    echo "Controller returned: ";
    var_export($response);
    echo "\n";
}

// Verify deletion
$exists = \App\Models\TimeLog::find($logId);
if ($exists) {
    echo "TimeLog $logId still exists\n";
} else {
    echo "TimeLog $logId deleted from DB\n";
}
