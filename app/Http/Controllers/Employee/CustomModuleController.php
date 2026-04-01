<?php

namespace App\Http\Controllers\Employee;

use App\Http\Controllers\Controller;
use App\Models\CustomModule;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CustomModuleController extends Controller
{
    /**
     * Get all custom modules assigned to the authenticated employee.
     */
    public function assignedModules(Request $request)
    {
        $employee = $request->user();

        try {
            // Get all custom module IDs assigned to this employee
            $assignedModuleIds = DB::table('custom_module_user_assignments')
                ->where('user_id', $employee->id)
                ->pluck('custom_module_id');

            if ($assignedModuleIds->isEmpty()) {
                return response()->json([
                    'modules' => [],
                    'total_count' => 0,
                    'message' => 'No modules assigned yet',
                ]);
            }

            // Fetch the actual modules with lessons and creator info
            $modules = CustomModule::with(['creator:id,fullname,email', 'lessons'])
                ->whereIn('id', $assignedModuleIds)
                ->where('status', 'published') // Only show published modules
                ->orderBy('order')
                ->get()
                ->map(function ($module) use ($employee) {
                    // Get assignment details
                    $assignment = DB::table('custom_module_user_assignments')
                        ->where('custom_module_id', $module->id)
                        ->where('user_id', $employee->id)
                        ->first();

                    // Calculate progress (if you have completion tracking)
                    $totalLessons = $module->lessons->count();
                    $completedLessons = 0; // TODO: Implement lesson completion tracking if needed

                    return [
                        'id' => $module->id,
                        'title' => $module->title,
                        'description' => $module->description,
                        'category' => $module->category,
                        'tags' => $module->tags,
                        'thumbnail_url' => $module->thumbnail_url,
                        'status' => $module->status,
                        'lessons_count' => $totalLessons,
                        'lessons' => $module->lessons,
                        'creator' => $module->creator,
                        'version' => $module->version,
                        'assigned_at' => $assignment->assigned_at ?? null,
                        'assigned_by' => $assignment->assigned_by ?? null,
                        'progress' => $totalLessons > 0 ? round(($completedLessons / $totalLessons) * 100) : 0,
                        'created_at' => $module->created_at,
                        'updated_at' => $module->updated_at,
                    ];
                });

            return response()->json([
                'modules' => $modules,
                'total_count' => $modules->count(),
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching assigned modules for employee', [
                'employee_id' => $employee->id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Error fetching assigned modules',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get a specific custom module with its lessons.
     */
    public function show(Request $request, int $id)
    {
        $employee = $request->user();

        try {
            // Check if this module is assigned to the employee
            $isAssigned = DB::table('custom_module_user_assignments')
                ->where('custom_module_id', $id)
                ->where('user_id', $employee->id)
                ->exists();

            if (!$isAssigned) {
                return response()->json([
                    'message' => 'This module is not assigned to you',
                ], 403);
            }

            // Fetch the module with lessons
            $module = CustomModule::with(['creator:id,fullname,email', 'lessons'])
                ->where('status', 'published')
                ->findOrFail($id);

            // Get assignment details
            $assignment = DB::table('custom_module_user_assignments')
                ->where('custom_module_id', $module->id)
                ->where('user_id', $employee->id)
                ->first();

            $assignedBy = null;
            if ($assignment && $assignment->assigned_by) {
                $assignedBy = User::select('id', 'fullname', 'email', 'role')
                    ->find($assignment->assigned_by);
            }

            return response()->json([
                'module' => $module,
                'assignment' => [
                    'assigned_at' => $assignment->assigned_at ?? null,
                    'assigned_by' => $assignedBy,
                ],
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching custom module for employee', [
                'employee_id' => $employee->id,
                'module_id' => $id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Error fetching module',
                'error' => $e->getMessage(),
            ], 500);
        }
    }
}
