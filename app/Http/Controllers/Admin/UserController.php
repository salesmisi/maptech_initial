<?php

namespace App\Http\Controllers\Admin;

use Illuminate\Support\Facades\Log;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Course;
use App\Models\CourseEnrollment;
use App\Models\Department;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

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
            'id', 'fullname', 'email', 'role', 'department', 'subdepartment_id', 'status', 'profile_picture', 'created_at'
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

        // Create user and set both fullname variants to be safe across DB schemas.
        $user = User::create([
            'fullName' => $validated['fullName'],
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

        // Map fullName to fullname for fillable
        if (isset($validated['fullName'])) {
            $validated['fullname'] = $validated['fullName'];
            unset($validated['fullName']);
        }

        $user->fill($validated);
        $user->save();

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
        try {
            $user = User::findOrFail($id);

            // Delete related records first to avoid foreign key issues
            $user->tokens()->delete(); // Sanctum tokens

            $user->delete();

            return response()->json([
                'message' => 'User deleted successfully'
            ]);
        } catch (\Exception $e) {
            \Log::error('Failed to delete user', [
                'user_id' => $id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Failed to delete user: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Bulk delete users by IDs passed as JSON { ids: [1,2,3] }
     */
    public function bulkDelete(Request $request)
    {
        $data = $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer|exists:users,id'
        ]);

        $ids = $data['ids'];

        try {
            $usersToDelete = User::whereIn('id', $ids)->get();
            foreach ($usersToDelete as $u) {
                $u->tokens()->delete();
                $u->delete();
            }

            return response()->json([
                'message' => 'Users deleted successfully',
                'deleted' => $ids
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to bulk delete users', ['ids' => $ids, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to delete users: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Upload profile picture for a user.
     */
    public function uploadPhoto(Request $request, string $id)
    {
        $user = User::findOrFail($id);

        $request->validate([
            'profile_picture' => 'required|image|mimes:png,jpg,jpeg|max:2048',
        ]);

        // Delete old photo if exists
        if ($user->profile_picture) {
            Storage::disk('public')->delete($user->profile_picture);
        }

        $path = $request->file('profile_picture')->store('profile-pictures', 'public');
        $user->update(['profile_picture' => $path]);

        return response()->json([
            'message' => 'Photo uploaded successfully',
            'profile_picture' => asset('storage/' . $path),
        ]);
    }

    /**
     * Get all enrollment activity (for View All Activity modal).
     */
    public function activity()
    {
        $activity = CourseEnrollment::with(['user:id,fullname', 'course:id,title'])
            ->orderBy('updated_at', 'desc')
            ->take(100)
            ->get()
            ->map(function ($enrollment) {
                $action = match ($enrollment->status) {
                    'Completed' => 'Completed Course',
                    'Dropped'   => 'Dropped Course',
                    default     => 'Enrolled',
                };
                return [
                    'id'     => $enrollment->id,
                    'user'   => $enrollment->user?->fullname ?? 'Unknown',
                    'action' => $action,
                    'target' => $enrollment->course?->title ?? 'Unknown',
                    'time'   => $enrollment->updated_at->diffForHumans(),
                ];
            });

        return response()->json($activity);
    }

    /**
     * Reports & Analytics data.
     */
    public function reports(Request $request)
    {
        $range = (int) ($request->query('months', 6));
        $since = now()->subMonths($range)->startOfMonth();

        // --- Overall Completion Status ---
        $completed  = CourseEnrollment::where('status', 'Completed')->count();
        $inProgress = CourseEnrollment::where('status', 'Active')->where('progress', '>', 0)->count();
        $notStarted = CourseEnrollment::where('status', 'Active')->where('progress', 0)->count();

        $completionStatus = [
            ['name' => 'Completed',   'value' => $completed],
            ['name' => 'In Progress', 'value' => $inProgress],
            ['name' => 'Not Started', 'value' => $notStarted],
        ];

        // --- Monthly Enrollment vs Completion Trends ---
        $enrollmentsByMonth = DB::table('course_enrollments')
            ->selectRaw("TO_CHAR(enrolled_at, 'Mon') as month, TO_CHAR(enrolled_at, 'YYYY-MM') as sort_key, COUNT(*) as enrollments")
            ->where('enrolled_at', '>=', $since)
            ->groupByRaw("TO_CHAR(enrolled_at, 'YYYY-MM'), TO_CHAR(enrolled_at, 'Mon')")
            ->orderByRaw("TO_CHAR(enrolled_at, 'YYYY-MM')")
            ->pluck('enrollments', 'sort_key');

        $completionsByMonth = DB::table('course_enrollments')
            ->selectRaw("TO_CHAR(completed_at, 'YYYY-MM') as sort_key, COUNT(*) as completions")
            ->where('status', 'Completed')
            ->whereNotNull('completed_at')
            ->where('completed_at', '>=', $since)
            ->groupByRaw("TO_CHAR(completed_at, 'YYYY-MM')")
            ->pluck('completions', 'sort_key');

        $monthLabels = DB::table('course_enrollments')
            ->selectRaw("TO_CHAR(enrolled_at, 'Mon') as label, TO_CHAR(enrolled_at, 'YYYY-MM') as sort_key")
            ->where('enrolled_at', '>=', $since)
            ->groupByRaw("TO_CHAR(enrolled_at, 'YYYY-MM'), TO_CHAR(enrolled_at, 'Mon')")
            ->orderByRaw("TO_CHAR(enrolled_at, 'YYYY-MM')")
            ->pluck('label', 'sort_key');

        $monthlyTrends = $monthLabels->map(function ($label, $key) use ($enrollmentsByMonth, $completionsByMonth) {
            return [
                'name'        => $label,
                'enrollments' => (int) ($enrollmentsByMonth[$key] ?? 0),
                'completions' => (int) ($completionsByMonth[$key] ?? 0),
            ];
        })->values();

        // --- Most Popular Courses (by enrollment count) ---
        $popularCourses = DB::table('course_enrollments')
            ->join('courses', 'course_enrollments.course_id', '=', 'courses.id')
            ->selectRaw('courses.title as name, COUNT(course_enrollments.id) as students')
            ->groupBy('courses.id', 'courses.title')
            ->orderByRaw('COUNT(course_enrollments.id) DESC')
            ->limit(10)
            ->get()
            ->map(fn($r) => ['name' => $r->name, 'students' => (int) $r->students])
            ->values();

        return response()->json([
            'completion_status' => $completionStatus,
            'monthly_trends'    => $monthlyTrends,
            'popular_courses'   => $popularCourses,
        ]);
    }

    /**
     * Export Reports as CSV.
     */
    public function exportReport(): StreamedResponse
    {
        $enrollments = CourseEnrollment::with(['user:id,fullname,department', 'course:id,title'])
            ->orderBy('enrolled_at', 'desc')
            ->get();

        $filename = 'report_' . now()->format('Y-m-d') . '.csv';

        return response()->streamDownload(function () use ($enrollments) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, ['Employee', 'Department', 'Course', 'Status', 'Progress (%)', 'Enrolled At', 'Completed At']);
            foreach ($enrollments as $e) {
                fputcsv($handle, [
                    $e->user?->fullname ?? 'Unknown',
                    $e->user?->department ?? '-',
                    $e->course?->title ?? 'Unknown',
                    $e->status,
                    $e->progress,
                    $e->enrolled_at?->format('Y-m-d H:i') ?? '',
                    $e->completed_at?->format('Y-m-d H:i') ?? '',
                ]);
            }
            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv',
        ]);
    }

    /**
     * Get admin dashboard stats.
     */
    public function dashboard()
    {
        // Stat cards
        $totalEmployees = User::where('role', 'Employee')->count();
        $activeCourses  = Course::where('status', 'Active')->count();

        $totalEnrollments     = CourseEnrollment::count();
        $completedEnrollments = CourseEnrollment::where('status', 'Completed')->count();
        $completionRate = $totalEnrollments > 0
            ? round(($completedEnrollments / $totalEnrollments) * 100)
            : 0;

        $avgQuizScore = (int) round(CourseEnrollment::whereNotNull('progress')->avg('progress') ?? 0);

        // Course completion trends — last 6 months (PostgreSQL)
        try {
            $completionTrends = DB::table('course_enrollments')
                ->selectRaw("TO_CHAR(completed_at, 'Mon') as name, TO_CHAR(completed_at, 'YYYY-MM') as month_key, COUNT(*) as rate")
                ->where('status', 'Completed')
                ->whereNotNull('completed_at')
                ->where('completed_at', '>=', now()->subMonths(6))
                ->groupByRaw("TO_CHAR(completed_at, 'YYYY-MM'), TO_CHAR(completed_at, 'Mon')")
                ->orderByRaw("TO_CHAR(completed_at, 'YYYY-MM')")
                ->get()
                ->map(fn($row) => ['name' => $row->name, 'rate' => (int) $row->rate])
                ->values();
        } catch (\Exception $e) {
            // Likely running on SQLite or other DB without TO_CHAR support; fall back to empty trends
            Log::warning('Completion trends query failed, falling back to empty set', ['error' => $e->getMessage()]);
            $completionTrends = collect();
        }

        // Department performance
        $departments = User::where('role', 'Employee')
            ->whereNotNull('department')
            ->distinct()
            ->pluck('department');

        $departmentPerformance = $departments->map(function ($dept) {
            $userIds   = User::where('role', 'Employee')->where('department', $dept)->pluck('id');
            $assigned  = CourseEnrollment::whereIn('user_id', $userIds)->count();
            $completed = CourseEnrollment::whereIn('user_id', $userIds)->where('status', 'Completed')->count();
            return ['name' => $dept, 'assigned' => $assigned, 'completed' => $completed];
        })->values();

        // Recent activity — last 10 enrollment events
        $recentActivity = CourseEnrollment::with(['user:id,fullname', 'course:id,title'])
            ->orderBy('updated_at', 'desc')
            ->take(10)
            ->get()
            ->map(function ($enrollment) {
                $action = match ($enrollment->status) {
                    'Completed' => 'Completed Course',
                    'Dropped'   => 'Dropped Course',
                    default     => 'Enrolled',
                };
                return [
                    'id'     => $enrollment->id,
                    'user'   => $enrollment->user?->fullname ?? 'Unknown',
                    'action' => $action,
                    'target' => $enrollment->course?->title ?? 'Unknown',
                    'time'   => $enrollment->updated_at->diffForHumans(),
                ];
            });

        return response()->json([
            'total_employees'        => $totalEmployees,
            'active_courses'         => $activeCourses,
            'completion_rate'        => $completionRate,
            'avg_quiz_score'         => $avgQuizScore,
            'completion_trends'      => $completionTrends,
            'department_performance' => $departmentPerformance,
            'recent_activity'        => $recentActivity,
        ]);
    }
}
