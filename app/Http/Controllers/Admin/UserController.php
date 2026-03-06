<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Course;
use App\Models\Department;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    /**
     * Get all users.
     */
    public function index(Request $request)
    {
        $query = User::query();

        // Filter by role (stored lowercase in DB; PostgreSQL is case-sensitive)
        if ($request->has('role')) {
            $query->where('role', strtolower($request->role));
        }

        // Filter by department
        if ($request->has('department')) {
            $query->where('department', $request->department);
        }

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $users = $query->select([
            'id', 'fullname', 'email', 'role', 'department', 'subdepartment_id', 'status', 'created_at'
        ])->orderBy('created_at', 'desc')->get();

        // Eager load subdepartment name, departments headed, and instructor subdepartments
        $users->load('subdepartment:id,name', 'headOfDepartments:id,name,head_id', 'subdepartments:id,name,department_id');

        return response()->json($users);
    }

    /**
     * Create a new user.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'fullName' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'role' => ['required', Rule::in(['Admin', 'Instructor', 'Employee'])],
            'department' => 'nullable|string|max:255',
            'subdepartment_id' => 'nullable|exists:subdepartments,id',
            'status' => ['nullable', Rule::in(['Active', 'Inactive'])],
        ]);

        // Require department for Employees
        if ($validated['role'] === 'Employee' && empty($validated['department'])) {
            return response()->json([
                'message' => 'Department is required for Employee role.',
                'errors' => ['department' => ['Department is required for Employee role.']]
            ], 422);
        }

        $user = User::create([
            'fullname' => $validated['fullName'],
            'email' => $validated['email'],
            'password' => $validated['password'],
            'role' => $validated['role'],
            'department' => $validated['department'] ?? null,
            'subdepartment_id' => $validated['subdepartment_id'] ?? null,
            'status' => $validated['status'] ?? 'Active',
        ]);

        // For instructors, sync subdepartments and optionally set as department head
        if ($validated['role'] === 'Instructor') {
            if ($request->has('subdepartment_ids')) {
                $user->subdepartments()->sync($request->input('subdepartment_ids', []));
            }
            if ($request->boolean('is_department_head') && $validated['department']) {
                $dept = Department::where('name', $validated['department'])->first();
                if ($dept) {
                    $dept->update(['head_id' => $user->id]);
                }
            }
        }

        return response()->json([
            'message' => 'User created successfully',
            'user' => $user->load('headOfDepartments:id,name,head_id', 'subdepartments:id,name,department_id')
        ], 201);
    }

    /**
     * Get a specific user.
     */
    public function show(string $id)
    {
        $user = User::findOrFail($id);

        return response()->json($user);
    }

    /**
     * Update a user.
     */
    public function update(Request $request, string $id)
    {
        $user = User::findOrFail($id);

        $validated = $request->validate([
            'fullName' => 'sometimes|string|max:255',
            'email' => ['sometimes', 'email', Rule::unique('users')->ignore($id)],
            'password' => 'sometimes|string|min:8',
            'role' => ['sometimes', Rule::in(['Admin', 'Instructor', 'Employee'])],
            'department' => 'nullable|string|max:255',
            'subdepartment_id' => 'nullable|exists:subdepartments,id',
            'status' => ['sometimes', Rule::in(['Active', 'Inactive'])],
        ]);

        // Require department for Employees
        $newRole = $validated['role'] ?? $user->role;
        if ($newRole === 'Employee' && isset($validated['department']) && empty($validated['department'])) {
            return response()->json([
                'message' => 'Department is required for Employee role.',
                'errors' => ['department' => ['Department is required for Employee role.']]
            ], 422);
        }

        // Update fields
        if (isset($validated['fullName'])) {
            $user->fullname = $validated['fullName'];
        }
        if (isset($validated['email'])) {
            $user->email = $validated['email'];
        }
        if (isset($validated['password'])) {
            $user->password = $validated['password'];
        }
        if (isset($validated['role'])) {
            $user->role = $validated['role'];
        }
        if (array_key_exists('department', $validated)) {
            $user->department = $validated['department'];
        }
        if (array_key_exists('subdepartment_id', $validated)) {
            $user->subdepartment_id = $validated['subdepartment_id'];
        }
        if (isset($validated['status'])) {
            $user->status = $validated['status'];
        }

        $user->save();

        // For instructors, sync subdepartments and handle department head
        $effectiveRole = strtolower($validated['role'] ?? $user->role);
        if ($effectiveRole === 'instructor') {
            if ($request->has('subdepartment_ids')) {
                $user->subdepartments()->sync($request->input('subdepartment_ids', []));
            }
            // Handle department head assignment
            $deptName = $validated['department'] ?? $user->department;
            if ($deptName) {
                $dept = Department::where('name', $deptName)->first();
                if ($dept) {
                    if ($request->boolean('is_department_head')) {
                        $dept->update(['head_id' => $user->id]);
                    } elseif ($dept->head_id === $user->id) {
                        $dept->update(['head_id' => null]);
                    }
                }
            }
        }

        // If role changed away from instructor, clean up
        if (isset($validated['role']) && $effectiveRole !== 'instructor') {
            Department::where('head_id', $user->id)->update(['head_id' => null]);
            $user->subdepartments()->detach();
        }

        return response()->json([
            'message' => 'User updated successfully',
            'user' => $user->load('headOfDepartments:id,name,head_id', 'subdepartments:id,name,department_id')
        ]);
    }

    /**
     * Delete a user.
     */
    public function destroy(string $id)
    {
        $user = User::findOrFail($id);
        $user->delete();

        return response()->json([
            'message' => 'User deleted successfully'
        ]);
    }

    /**
     * Get admin dashboard stats.
     */
    public function dashboard()
    {
        return response()->json([
            'total_users' => User::count(),
            'active_users' => User::where('status', 'Active')->count(),
            'inactive_users' => User::where('status', 'Inactive')->count(),
            'admins' => User::where('role', 'Admin')->count(),
            'instructors' => User::where('role', 'Instructor')->count(),
            'employees' => User::where('role', 'Employee')->count(),
            'total_courses' => Course::count(),
        ]);
    }
}
