<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(\Illuminate\Contracts\Http\Kernel::class);
$kernel->bootstrap();

// Simulate admin index
$user = \App\Models\User::find(1);
\Illuminate\Support\Facades\Auth::login($user);

// Call the controller method directly
$controller = new \App\Http\Controllers\QAController();
$request = \Illuminate\Http\Request::create('/api/admin/questions', 'GET');
$request->setUserResolver(function () use ($user) { return $user; });

try {
    $response = $controller->adminIndex($request);
    $data = json_decode($response->getContent(), true);
    echo "Admin index - Questions: " . count($data) . PHP_EOL;
    foreach ($data as $q) {
        echo "  Q#{$q['id']}: '{$q['question']}'" . PHP_EOL;
        echo "    replies count: " . count($q['replies'] ?? []) . PHP_EOL;
        if (!empty($q['replies'])) {
            foreach ($q['replies'] as $r) {
                echo "    -> Reply #{$r['id']} by " . ($r['user']['fullName'] ?? 'null') . " (" . ($r['user']['role'] ?? 'null') . "): " . $r['message'] . PHP_EOL;
            }
        }
    }
} catch (\Exception $e) {
    echo "ADMIN INDEX ERROR: " . $e->getMessage() . PHP_EOL;
    echo $e->getTraceAsString() . PHP_EOL;
}

// Test store reply
echo PHP_EOL . "--- Testing storeReply ---" . PHP_EOL;
$request2 = \Illuminate\Http\Request::create('/api/admin/questions/1/replies', 'POST');
$request2->setUserResolver(function () use ($user) { return $user; });
$request2->merge(['message' => 'Test reply via controller']);

try {
    $response2 = $controller->storeReply($request2, 1);
    echo "Status: " . $response2->getStatusCode() . PHP_EOL;
    echo "Body: " . $response2->getContent() . PHP_EOL;
} catch (\Exception $e) {
    echo "REPLY ERROR: " . $e->getMessage() . PHP_EOL;
    echo $e->getTraceAsString() . PHP_EOL;
}

// Test employee side
echo PHP_EOL . "--- Testing Employee Index ---" . PHP_EOL;
$employee = \App\Models\User::find(6);
$request3 = \Illuminate\Http\Request::create('/api/employee/questions', 'GET');
$request3->setUserResolver(function () use ($employee) { return $employee; });

try {
    $response3 = $controller->employeeIndex($request3);
    $data3 = json_decode($response3->getContent(), true);
    echo "Employee questions: " . count($data3) . PHP_EOL;
    foreach ($data3 as $q) {
        echo "  Q#{$q['id']}: replies=" . count($q['replies'] ?? []) . PHP_EOL;
    }
} catch (\Exception $e) {
    echo "EMPLOYEE INDEX ERROR: " . $e->getMessage() . PHP_EOL;
    echo $e->getTraceAsString() . PHP_EOL;
}

// Test employee reply
echo PHP_EOL . "--- Testing Employee Reply ---" . PHP_EOL;
$request4 = \Illuminate\Http\Request::create('/api/employee/questions/1/replies', 'POST');
$request4->setUserResolver(function () use ($employee) { return $employee; });
$request4->merge(['message' => 'Employee reply to admin']);

try {
    $response4 = $controller->storeReply($request4, 1);
    echo "Status: " . $response4->getStatusCode() . PHP_EOL;
    echo "Body: " . $response4->getContent() . PHP_EOL;
} catch (\Exception $e) {
    echo "EMPLOYEE REPLY ERROR: " . $e->getMessage() . PHP_EOL;
    echo $e->getTraceAsString() . PHP_EOL;
}
