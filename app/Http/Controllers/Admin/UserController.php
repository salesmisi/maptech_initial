<?php

namespace App\Http\Controllers\Admin;

use Illuminate\Support\Facades\Log;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Course;
use App\Models\CourseEnrollment;
use App\Models\Enrollment;
use App\Models\QuizAttempt;
use App\Models\Department;
use App\Models\Subdepartment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;
use App\Rules\MaptechEmail;
use App\Rules\StrongPassword;

class UserController extends Controller
{
    /**
     * Get all users.
     */
    public function index(Request $request)
    {
        $query = User::query();

        // Search by name/email
        if ($request->filled('q')) {
            $term = strtolower(trim((string) $request->input('q')));
            $like = '%' . $term . '%';
            $query->where(function ($q) use ($like) {
                $q->whereRaw('LOWER(fullname) LIKE ?', [$like])
                  ->orWhereRaw('LOWER(email) LIKE ?', [$like]);
            });
        }

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

        // Filter by employee subdepartment
        if ($request->filled('subdepartment_id')) {
            $query->where('subdepartment_id', (int) $request->input('subdepartment_id'));
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
            'email' => ['required', 'email', new MaptechEmail, 'unique:users,email'],
            'password' => ['required', 'string', new StrongPassword],
            'role' => ['required', Rule::in(['Admin', 'Instructor', 'Employee'])],
            'department' => 'nullable|string|max:255',
            'subdepartment_id' => 'nullable|exists:subdepartments,id',
            'status' => ['nullable', Rule::in(['Active', 'Inactive'])],
        ]);

        $role = strtolower((string) ($validated['role'] ?? ''));

        // Require both department and subdepartment for employees
        if ($role === 'employee' && empty($validated['department'])) {
            return response()->json([
                'message' => 'Department is required for Employee role.',
                'errors' => ['department' => ['Department is required for Employee role.']]
            ], 422);
        }

        if ($role === 'employee' && empty($validated['subdepartment_id'])) {
            return response()->json([
                'message' => 'Subdepartment is required for Employee role.',
                'errors' => ['subdepartment_id' => ['Subdepartment is required for Employee role.']]
            ], 422);
        }

        if ($role === 'employee' && !empty($validated['subdepartment_id']) && !empty($validated['department'])) {
            $sub = Subdepartment::with('department')->find((int) $validated['subdepartment_id']);
            $deptName = $sub?->department?->name;

            if (!$deptName || strcasecmp((string) $deptName, (string) $validated['department']) !== 0) {
                return response()->json([
                    'message' => 'Selected subdepartment does not belong to the chosen department.',
                    'errors' => ['subdepartment_id' => ['Selected subdepartment does not belong to the chosen department.']]
                ], 422);
            }
        }

        // Create user; store into lowercase `fullname` column used by this schema.
        // The API still exposes `fullName` as a JSON field for frontend compatibility.
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
        $previousRole = strtolower((string) $user->role);
        $previousDepartment = strtolower(trim((string) ($user->department ?? '')));
        $previousSubdepartmentId = (int) ($user->subdepartment_id ?? 0);

        $validated = $request->validate([
            'fullName' => 'sometimes|string|max:255',
            'email' => ['sometimes', 'email', new MaptechEmail, Rule::unique('users')->ignore($id)],
            'password' => ['sometimes', 'string', new StrongPassword],
            'role' => ['sometimes', Rule::in(['Admin', 'Instructor', 'Employee'])],
            'department' => 'nullable|string|max:255',
            'subdepartment_id' => 'nullable|exists:subdepartments,id',
            'status' => ['sometimes', Rule::in(['Active', 'Inactive'])],
        ]);

        // Build effective values after this update for cross-field validation
        $effectiveRole = strtolower((string) ($validated['role'] ?? $user->role));
        $effectiveDepartment = array_key_exists('department', $validated)
            ? $validated['department']
            : $user->department;
        $effectiveSubdepartmentId = array_key_exists('subdepartment_id', $validated)
            ? $validated['subdepartment_id']
            : $user->subdepartment_id;

        // Require both department and subdepartment for employees
        if ($effectiveRole === 'employee' && empty($effectiveDepartment)) {
            return response()->json([
                'message' => 'Department is required for Employee role.',
                'errors' => ['department' => ['Department is required for Employee role.']]
            ], 422);
        }

        if ($effectiveRole === 'employee' && empty($effectiveSubdepartmentId)) {
            return response()->json([
                'message' => 'Subdepartment is required for Employee role.',
                'errors' => ['subdepartment_id' => ['Subdepartment is required for Employee role.']]
            ], 422);
        }

        if ($effectiveRole === 'employee' && !empty($effectiveSubdepartmentId) && !empty($effectiveDepartment)) {
            $sub = Subdepartment::with('department')->find((int) $effectiveSubdepartmentId);
            $deptName = $sub?->department?->name;

            if (!$deptName || strcasecmp((string) $deptName, (string) $effectiveDepartment) !== 0) {
                return response()->json([
                    'message' => 'Selected subdepartment does not belong to the chosen department.',
                    'errors' => ['subdepartment_id' => ['Selected subdepartment does not belong to the chosen department.']]
                ], 422);
            }
        }

        // Map fullName to fullname for fillable
        if (isset($validated['fullName'])) {
            $validated['fullname'] = $validated['fullName'];
            unset($validated['fullName']);
        }

        $user->fill($validated);
        $user->save();

        $currentRole = strtolower((string) $user->role);
        $currentDepartment = strtolower(trim((string) ($user->department ?? '')));
        $currentSubdepartmentId = (int) ($user->subdepartment_id ?? 0);

        $employeeAssignmentChanged = $currentRole === 'employee' && (
            $previousRole !== 'employee'
            || $previousDepartment !== $currentDepartment
            || $previousSubdepartmentId !== $currentSubdepartmentId
        );

        if ($employeeAssignmentChanged) {
            $this->removeInvalidEnrollmentsForEmployee($user);
        }

        // For instructors, sync subdepartments and handle department head
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

    private function normalizeDepartmentValue(?string $value): string
    {
        return strtolower(trim((string) $value));
    }

    private function acceptedCourseDepartments(?string $courseDepartment): array
    {
        $courseDepartmentLower = $this->normalizeDepartmentValue($courseDepartment);
        if ($courseDepartmentLower === '') {
            return [];
        }

        $deptRecord = DB::table('departments')
            ->select('name', 'code')
            ->whereRaw('LOWER(name) = ?', [$courseDepartmentLower])
            ->orWhereRaw('LOWER(code) = ?', [$courseDepartmentLower])
            ->first();

        $accepted = [$courseDepartmentLower];
        if ($deptRecord) {
            $deptName = $this->normalizeDepartmentValue($deptRecord->name ?? '');
            $deptCode = $this->normalizeDepartmentValue($deptRecord->code ?? '');
            if ($deptName !== '') {
                $accepted[] = $deptName;
            }
            if ($deptCode !== '') {
                $accepted[] = $deptCode;
            }
        }

        return array_values(array_unique($accepted));
    }

    private function employeeCanStayEnrolled(User $employee, Course $course): bool
    {
        $employeeDepartment = $this->normalizeDepartmentValue($employee->department);
        $acceptedDepartments = $this->acceptedCourseDepartments($course->department);
        if ($employeeDepartment === '' || empty($acceptedDepartments) || !in_array($employeeDepartment, $acceptedDepartments, true)) {
            return false;
        }

        if (!empty($course->subdepartment_id) && (int) ($employee->subdepartment_id ?? 0) !== (int) $course->subdepartment_id) {
            return false;
        }

        return true;
    }

    private function removeInvalidEnrollmentsForEmployee(User $employee): void
    {
        $enrollments = Enrollment::with('course:id,department,subdepartment_id')
            ->where('user_id', $employee->id)
            ->get();

        $invalidCourseIds = $enrollments
            ->filter(function (Enrollment $enrollment) use ($employee) {
                if (!$enrollment->course) {
                    return true;
                }

                return !$this->employeeCanStayEnrolled($employee, $enrollment->course);
            })
            ->pluck('course_id')
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values();

        if ($invalidCourseIds->isEmpty()) {
            return;
        }

        Enrollment::where('user_id', $employee->id)
            ->whereIn('course_id', $invalidCourseIds)
            ->delete();

        $moduleIds = DB::table('modules')
            ->whereIn('course_id', $invalidCourseIds)
            ->pluck('id');

        if ($moduleIds->isNotEmpty()) {
            DB::table('module_user')
                ->where('user_id', $employee->id)
                ->whereIn('module_id', $moduleIds)
                ->delete();
        }

        Log::info('Removed invalid enrollments after employee assignment update.', [
            'user_id' => $employee->id,
            'invalid_course_ids' => $invalidCourseIds->all(),
            'removed_count' => $invalidCourseIds->count(),
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
            Log::error('Failed to delete user', [
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
            /** @var \Illuminate\Database\Eloquent\Collection<int, User> $usersToDelete */
            $usersToDelete = User::whereIn('id', $ids)->get();
            /** @var User $u */
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
        $activity = Enrollment::with(['user:id,fullname', 'course:id,title'])
            ->orderBy('updated_at', 'desc')
            ->take(100)
            ->get()
            ->map(function ($enrollment) {
                $action = match ($enrollment->status) {
                    'Completed' => 'Completed Course',
                    'Dropped'   => 'Dropped Course',
                    'In Progress' => 'Started Course',
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
        $total = Enrollment::count();
        $completed  = Enrollment::where('status', 'Completed')->count();
        $inProgress = Enrollment::where(function ($query) {
            $query->where('status', 'In Progress')
                ->orWhere(function ($q) {
                    $q->where('status', 'Active')
                        ->where('progress', '>', 0)
                        ->where('progress', '<', 100);
                });
        })->count();
        $notStarted = max(0, $total - $completed - $inProgress);

        $completionStatus = [
            ['name' => 'Completed',   'value' => $completed],
            ['name' => 'In Progress', 'value' => $inProgress],
            ['name' => 'Not Started', 'value' => $notStarted],
        ];

        // --- Monthly Enrollment vs Completion Trends ---
        $enrollmentsByMonth = DB::table('enrollments')
            ->selectRaw("TO_CHAR(enrolled_at, 'Mon') as month, TO_CHAR(enrolled_at, 'YYYY-MM') as sort_key, COUNT(*) as enrollments")
            ->where('enrolled_at', '>=', $since)
            ->groupByRaw("TO_CHAR(enrolled_at, 'YYYY-MM'), TO_CHAR(enrolled_at, 'Mon')")
            ->orderByRaw("TO_CHAR(enrolled_at, 'YYYY-MM')")
            ->pluck('enrollments', 'sort_key');

        $completionsByMonth = DB::table('enrollments')
            ->selectRaw("TO_CHAR(updated_at, 'YYYY-MM') as sort_key, COUNT(*) as completions")
            ->where('status', 'Completed')
            ->where('updated_at', '>=', $since)
            ->groupByRaw("TO_CHAR(updated_at, 'YYYY-MM')")
            ->pluck('completions', 'sort_key');

        $monthLabels = DB::table('enrollments')
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
        $popularCourses = DB::table('enrollments')
            ->join('courses', 'enrollments.course_id', '=', 'courses.id')
            ->selectRaw('courses.title as name, COUNT(enrollments.id) as students')
            ->groupBy('courses.id', 'courses.title')
            ->orderByRaw('COUNT(enrollments.id) DESC')
            ->limit(10)
            ->get()
            ->map(function ($r) {
                $name = (string) ($r->name ?? '');
                // Remove mojibake ellipsis variants and replacement/control chars, then normalize whitespace.
                $name = preg_replace('/(ΓÇª|Γçª|â€¦|…|Ã¢â‚¬Â¦|çª|Çª)/u', ' ', $name) ?? $name;
                $name = preg_replace('/[\x{2028}\x{2029}\x{FFFD}\x00-\x1F\x7F\x80-\x9F]/u', ' ', $name) ?? $name;
                $name = preg_replace('/\s+/u', ' ', $name) ?? $name;

                return [
                    'name' => trim($name),
                    'students' => (int) $r->students,
                ];
            })
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
        $enrollments = Enrollment::with(['user:id,fullname,department', 'course:id,title'])
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
                    $e->status === 'Completed' ? ($e->updated_at?->format('Y-m-d H:i') ?? '') : '',
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
        $totalEmployees = User::where('role', 'employee')->count();
        $activeEmployees = User::where('role', 'employee')
            ->where('status', 'Active')
            ->count();
        $activeCourses  = Course::where('status', 'Active')->count();

        $totalEnrollments     = Enrollment::count();
        $completedEnrollments = Enrollment::where('status', 'Completed')->count();
        $completionRate = $totalEnrollments > 0
            ? round(($completedEnrollments / $totalEnrollments) * 100)
            : 0;

        // Average based on actual quiz attempt percentages.
        $avgQuizScore = (int) round(QuizAttempt::avg('percentage') ?? 0);

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
        $departments = User::where('role', 'employee')
            ->whereNotNull('department')
            ->distinct()
            ->pluck('department');

        $departmentPerformance = $departments->map(function ($dept) {
            $userIds   = User::where('role', 'employee')->where('department', $dept)->pluck('id');
            $assigned  = Enrollment::whereIn('user_id', $userIds)->count();
            $completed = Enrollment::whereIn('user_id', $userIds)->where('status', 'Completed')->count();
            return ['name' => $dept, 'assigned' => $assigned, 'completed' => $completed];
        })->values();

        // Recent activity — last 10 enrollment events
        $recentActivity = Enrollment::with(['user:id,fullname', 'course:id,title'])
            ->orderBy('updated_at', 'desc')
            ->take(10)
            ->get()
            ->map(function ($enrollment) {
                $action = match ($enrollment->status) {
                    'Completed' => 'Completed Course',
                    'Dropped'   => 'Dropped Course',
                    'In Progress' => 'Started Course',
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
            'active_employees'       => $activeEmployees,
            'active_courses'         => $activeCourses,
            'completion_rate'        => $completionRate,
            'avg_quiz_score'         => $avgQuizScore,
            'completion_trends'      => $completionTrends,
            'department_performance' => $departmentPerformance,
            'recent_activity'        => $recentActivity,
        ]);
    }
}
