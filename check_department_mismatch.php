<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make('Illuminate\Contracts\Console\Kernel');
$kernel->bootstrap();

// Get instructor
$instructor = App\Models\User::find(8);
echo "Instructor department: '" . $instructor->department . "'\n";
echo "Department length: " . strlen($instructor->department) . "\n";
echo "Department hex: " . bin2hex($instructor->department) . "\n\n";

// Get all employees
$employees = App\Models\User::where('role', 'Employee')->get();

echo "All employees in database:\n";
foreach ($employees as $emp) {
    $dept = $emp->department ?? 'NULL';
    echo "- {$emp->fullname}: '{$dept}' (len: " . strlen($dept) . ")\n";

    // Check if it matches
    $matches = ($emp->department === $instructor->department) ? 'MATCH' : 'NO MATCH';
    echo "  Compare: {$matches}\n";

    if ($emp->department && $emp->department !== $instructor->department) {
        echo "  Hex instructor: " . bin2hex($instructor->department) . "\n";
        echo "  Hex employee:   " . bin2hex($emp->department) . "\n";
    }
}
