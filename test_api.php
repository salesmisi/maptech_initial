<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make('Illuminate\Contracts\Console\Kernel');
$kernel->bootstrap();

// Find the first custom module
$customModule = App\Models\CustomModule::first();

if (!$customModule) {
    echo "No custom modules found. Creating a test module...\n";
    exit(1);
}

echo "Testing with module ID: {$customModule->id}\n";
echo "Module title: {$customModule->title}\n\n";

// Get instructor user (ID 8 - Ken Nava)
$instructor = App\Models\User::find(8);
echo "Instructor: {$instructor->fullname}\n";
echo "Instructor department: {$instructor->department}\n\n";

// Get employees in instructor's department
$employees = App\Models\User::where('role', 'Employee')
    ->where('department', $instructor->department)
    ->select('id', 'fullname', 'email', 'department', 'status')
    ->orderBy('fullname')
    ->get();

echo "Employees found: {$employees->count()}\n\n";

foreach ($employees as $emp) {
    $isPushed = DB::table('custom_module_user_assignments')
        ->where('custom_module_id', $customModule->id)
        ->where('user_id', $emp->id)
        ->exists();

    echo "- {$emp->fullname} ({$emp->email}) - {$emp->status}" . ($isPushed ? " [ALREADY PUSHED]" : "") . "\n";
}
