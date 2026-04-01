<?php

namespace App\Http\Controllers\Instructor;

use App\Http\Controllers\Controller;
use App\Models\CustomModule;
use App\Models\Notification;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Exception;

class CustomModuleController extends Controller
{
    /**
     * Push a custom module to all employees in the instructor's department.
     */
    public function pushToDepartment(Request $request, int $id)
    {
        $instructor = $request->user();

        // Check if instructor has a department assigned
        if (!$instructor->department) {
            return response()->json([
                'message' => 'You are not assigned to any department',
                'success_count' => 0,
            ], 400);
        }

        $customModule = CustomModule::with('lessons')->findOrFail($id);

        try {
            $successCount = 0;

            // Get all employees in the instructor's department (both active and inactive)
            $employees = User::where('role', 'employee') // role is stored lowercase in database
                ->where('department', $instructor->department)
                ->get();

            if ($employees->isEmpty()) {
                return response()->json([
                    'message' => 'No employees found in your department',
                    'success_count' => 0,
                ]);
            }

            DB::transaction(function () use ($customModule, $employees, $instructor, &$successCount) {
                foreach ($employees as $employee) {
                    // Create or update assignment
                    DB::table('custom_module_user_assignments')->updateOrInsert(
                        [
                            'custom_module_id' => $customModule->id,
                            'user_id' => $employee->id,
                        ],
                        [
                            'assigned_by' => $instructor->id,
                            'assigned_at' => now(),
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]
                    );

                    // Create notification for the employee
                    Notification::create([
                        'user_id' => $employee->id,
                        'type' => 'custom_module_assigned',
                        'title' => 'New Learning Module Available',
                        'message' => "Your instructor has assigned you the module \"{$customModule->title}\".",
                        'data' => [
                            'module_id' => $customModule->id,
                            'module_title' => $customModule->title,
                            'assigned_by' => $instructor->fullname,
                        ],
                    ]);

                    $successCount++;
                }
            });

            $message = "Module pushed to {$successCount} employee" . ($successCount > 1 ? 's' : '') . " in {$instructor->department} department";

            Log::info('Instructor pushed module to department', [
                'instructor_id' => $instructor->id,
                'module_id' => $customModule->id,
                'department' => $instructor->department,
                'employees_count' => $successCount,
            ]);

            return response()->json([
                'message' => $message,
                'success_count' => $successCount,
                'department' => $instructor->department,
            ]);
        } catch (Exception $e) {
            Log::error('Error pushing module to department', [
                'instructor_id' => $instructor->id,
                'module_id' => $id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'An error occurred while pushing the module to your department',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get employees in instructor's department for preview.
     */
    public function getDepartmentEmployees(Request $request, int $id)
    {
        $instructor = $request->user();

        // Check if instructor has a department assigned
        if (!$instructor->department) {
            return response()->json([
                'employees' => [],
                'department' => null,
                'total_count' => 0,
                'message' => 'You are not assigned to any department',
            ]);
        }

        $customModule = CustomModule::findOrFail($id);

        // Get all employees in the instructor's department (both active and inactive)
        $employees = User::where('role', 'employee') // role is stored lowercase in database
            ->where('department', $instructor->department)
            ->select('id', 'fullname', 'email', 'department', 'status')
            ->orderBy('fullname')
            ->get()
            ->map(function ($employee) use ($customModule) {
                // Check if already pushed
                $isPushed = DB::table('custom_module_user_assignments')
                    ->where('custom_module_id', $customModule->id)
                    ->where('user_id', $employee->id)
                    ->exists();

                return [
                    'id' => $employee->id,
                    'fullname' => $employee->fullname,
                    'email' => $employee->email,
                    'department' => $employee->department,
                    'status' => $employee->status,
                    'is_pushed' => $isPushed,
                ];
            });

        return response()->json([
            'employees' => $employees,
            'department' => $instructor->department,
            'total_count' => $employees->count(),
        ]);
    }
}
