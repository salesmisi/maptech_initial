<?php

namespace App\Http\Controllers\Admin;

use Carbon\Carbon;
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
        $archived = filter_var($request->query('archived'), FILTER_VALIDATE_BOOLEAN);

        if ($archived) {
            $query->onlyTrashed();
        }

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

        // Filter by employee subdepartment OR instructor subdepartment (via pivot or head_id)
        if ($request->filled('subdepartment_id')) {
            $subdeptId = (int) $request->input('subdepartment_id');
            $query->where(function ($q) use ($subdeptId) {
                $q->where('subdepartment_id', $subdeptId)
                  ->orWhereHas('subdepartments', fn ($sq) => $sq->where('subdepartments.id', $subdeptId))
                  ->orWhereIn('id', \App\Models\Subdepartment::where('id', $subdeptId)->pluck('head_id')->filter());
            });
        }

        $users = $query->select([
            'id', 'fullname', 'email', 'role', 'department', 'subdepartment_id', 'status', 'profile_picture', 'created_at', 'deleted_at'
        ])->orderBy($archived ? 'deleted_at' : 'created_at', 'desc')->get();

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

        // Generate recovery key for the new user
        $recoveryKey = User::generateRecoveryKey();

        $user = User::create([
            'fullname' => $validated['fullName'],
            'email' => $validated['email'],
            'password' => $validated['password'],
            'recovery_key_hash' => hash('sha256', $recoveryKey),
            'recovery_key' => $recoveryKey,
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
            'user' => $user->load('headOfDepartments:id,name,head_id', 'subdepartments:id,name,department_id'),
            'recovery_key' => $recoveryKey,
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
     * Archive a user (soft delete).
     */
    public function destroy(string $id)
    {
        try {
            $user = User::findOrFail($id);
            $role = strtolower((string) $user->role);

            if (!in_array($role, ['instructor', 'employee'], true)) {
                return response()->json([
                    'message' => 'Only instructor and employee accounts can be archived.'
                ], 422);
            }

            // Revoke tokens so the archived account cannot access the app
            $user->tokens()->delete();

            $user->delete();

            return response()->json([
                'message' => 'User archived successfully'
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to archive user', [
                'user_id' => $id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Failed to archive user: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Restore an archived user.
     */
    public function restore(string $id)
    {
        try {
            $user = User::onlyTrashed()->findOrFail($id);
            $role = strtolower((string) $user->role);

            if (!in_array($role, ['instructor', 'employee'], true)) {
                return response()->json([
                    'message' => 'Only instructor and employee accounts can be restored.'
                ], 422);
            }

            $user->restore();

            return response()->json([
                'message' => 'User restored successfully'
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to restore user', [
                'user_id' => $id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Failed to restore user: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Bulk archive users by IDs passed as JSON { ids: [1,2,3] }
     */
    public function bulkDelete(Request $request)
    {
        $data = $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer|exists:users,id'
        ]);

        $ids = $data['ids'];

        try {
            /** @var \Illuminate\Database\Eloquent\Collection<int, User> $usersToArchive */
            $usersToArchive = User::whereIn('id', $ids)->get();
            $archived = [];
            $skipped = [];

            /** @var User $u */
            foreach ($usersToArchive as $u) {
                $role = strtolower((string) $u->role);
                if (!in_array($role, ['instructor', 'employee'], true)) {
                    $skipped[] = $u->id;
                    continue;
                }

                $u->tokens()->delete();
                $u->delete();
                $archived[] = $u->id;
            }

            return response()->json([
                'message' => 'Users archived successfully',
                'archived' => $archived,
                'skipped' => $skipped,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to bulk archive users', ['ids' => $ids, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to archive users: ' . $e->getMessage()], 500);
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
        $range = (int) ($request->query('months', 12));
        $range = max(1, min($range, 12));

        // Use a calendar-based window that always starts in January.
        // For shorter ranges, render Jan..N months of the current year.
        $since = now()->copy()->startOfYear();
        $monthsToRender = $range === 12 ? 12 : $range;

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
        $monthlyTrends = [];

        for ($i = 0; $i < $monthsToRender; $i++) {
            $month = $since->copy()->addMonths($i);
            $monthKey = $month->format('Y-m');

            $monthlyTrends[$monthKey] = [
                'sort_key' => $monthKey,
                'name' => $month->format('M'),
                'enrollments' => 0,
                'completions' => 0,
            ];
        }

        $enrollments = DB::table('enrollments')
            ->select(['enrolled_at', 'updated_at', 'status'])
            ->where('enrolled_at', '>=', $since)
            ->where('enrolled_at', '<', $since->copy()->addMonths($monthsToRender))
            ->get();

        foreach ($enrollments as $enrollment) {
            if ($enrollment->enrolled_at) {
                $enrolledKey = Carbon::parse($enrollment->enrolled_at)->format('Y-m');
                if (isset($monthlyTrends[$enrolledKey])) {
                    $monthlyTrends[$enrolledKey]['enrollments']++;
                }
            }

            if ($enrollment->status === 'Completed' && $enrollment->updated_at) {
                $completedKey = Carbon::parse($enrollment->updated_at)->format('Y-m');
                if (isset($monthlyTrends[$completedKey])) {
                    $monthlyTrends[$completedKey]['completions']++;
                }
            }
        }

        $monthlyTrends = array_values($monthlyTrends);

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
     * Export Reports as Excel.
     */
    public function exportReport()
    {
        $enrollments = Enrollment::with(['user:id,fullname,department', 'course:id,title'])
            ->orderBy('enrolled_at', 'desc')
            ->get();

        if (!class_exists('ZipArchive')) {
            return response()->json([
                'message' => 'Server is missing the PHP zip extension. Please contact the administrator.',
            ], 500);
        }

        $timestamp = date('Y-m-d_His');
        $filename = 'report_' . date('Y-m-d') . '.xlsx';
        $logoPath = public_path('assets/Maptech-Official-Logo.png');
        $hasLogo = file_exists($logoPath);
        $genInfo = 'Generated: ' . date('F j, Y g:i A') . '  |  Total Records: ' . count($enrollments);

        $brandDark = 'FF0B5F2A';
        $brandPrimary = 'FF1B8F3A';
        $brandLight = 'FFE8F6ED';
        $borderColor = 'FFCCE5D4';

        $xe = fn($s) => htmlspecialchars((string) $s, ENT_XML1, 'UTF-8');
        $logoCx = null;
        $logoCy = null;
        if ($hasLogo) {
            $logoDims = @getimagesize($logoPath);
            $logoWidthPx = (int) ($logoDims[0] ?? 0);
            $logoHeightPx = (int) ($logoDims[1] ?? 0);
            $maxWidthPx = 240;
            $maxHeightPx = 52;
            if ($logoWidthPx > 0 && $logoHeightPx > 0) {
                $scale = min($maxWidthPx / $logoWidthPx, $maxHeightPx / $logoHeightPx, 1);
                $scaledWidth = (int) round($logoWidthPx * $scale);
                $scaledHeight = (int) round($logoHeightPx * $scale);
                $logoCx = $scaledWidth * 9525;
                $logoCy = $scaledHeight * 9525;
            }
        }

        $headers = ['Employee', 'Department', 'Course', 'Status', 'Progress (%)', 'Enrolled At', 'Completed At'];
        $colLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
        $colWidths = [24, 20, 30, 14, 14, 20, 20];

        $sw = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
        $sw .= '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
        $sw .= ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">';
        $sw .= '<sheetFormatPr defaultRowHeight="15"/>';
        $sw .= '<cols>';
        foreach ($colWidths as $i => $w) {
            $sw .= '<col min="' . ($i + 1) . '" max="' . ($i + 1) . '" width="' . $w . '" customWidth="1"/>';
        }
        $sw .= '</cols>';
        $sw .= '<sheetData>';
        $sw .= '<row r="1" ht="50" customHeight="1"/>';
        $sw .= '<row r="2" ht="22" customHeight="1">';
        $sw .= '<c r="A2" s="1" t="inlineStr"><is><t>' . $xe('Reports & Analytics Report') . '</t></is></c>';
        $sw .= '</row>';
        $sw .= '<row r="3" ht="14" customHeight="1">';
        $sw .= '<c r="A3" s="2" t="inlineStr"><is><t>' . $xe($genInfo) . '</t></is></c>';
        $sw .= '</row>';
        $sw .= '<row r="4" ht="18" customHeight="1">';
        foreach ($colLetters as $i => $letter) {
            $sw .= '<c r="' . $letter . '4" s="3" t="inlineStr"><is><t>' . $xe($headers[$i]) . '</t></is></c>';
        }
        $sw .= '</row>';

        $rowNum = 5;
        foreach ($enrollments as $e) {
            $styleId = ($rowNum % 2 === 0) ? 5 : 4;
            $sw .= '<row r="' . $rowNum . '">';
            $vals = [
                $e->user?->fullname ?? 'Unknown',
                $e->user?->department ?? '-',
                $e->course?->title ?? 'Unknown',
                $e->status ?? '',
                (string) ($e->progress ?? ''),
                $e->enrolled_at?->format('Y-m-d H:i') ?? '',
                $e->status === 'Completed' ? ($e->updated_at?->format('Y-m-d H:i') ?? '') : '',
            ];
            foreach ($colLetters as $i => $letter) {
                $sw .= '<c r="' . $letter . $rowNum . '" s="' . $styleId . '" t="inlineStr"><is><t>' . $xe($vals[$i]) . '</t></is></c>';
            }
            $sw .= '</row>';
            $rowNum++;
        }

        $sw .= '</sheetData>';
        $sw .= '<mergeCells count="2"><mergeCell ref="A2:G2"/><mergeCell ref="A3:G3"/></mergeCells>';
        if ($hasLogo) { $sw .= '<drawing r:id="rId1"/>'; }
        $sw .= '</worksheet>';

        $sx = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
        $sx .= '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
        $sx .= '<fonts count="5">';
        $sx .= '<font><sz val="11"/><name val="Calibri"/></font>';
        $sx .= '<font><b/><sz val="14"/><color rgb="' . $brandDark . '"/><name val="Calibri"/></font>';
        $sx .= '<font><sz val="10"/><color rgb="FF555555"/><name val="Calibri"/></font>';
        $sx .= '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>';
        $sx .= '<font><sz val="11"/><name val="Calibri"/></font>';
        $sx .= '</fonts>';
        $sx .= '<fills count="4">';
        $sx .= '<fill><patternFill patternType="none"/></fill>';
        $sx .= '<fill><patternFill patternType="gray125"/></fill>';
        $sx .= '<fill><patternFill patternType="solid"><fgColor rgb="' . $brandPrimary . '"/></patternFill></fill>';
        $sx .= '<fill><patternFill patternType="solid"><fgColor rgb="' . $brandLight . '"/></patternFill></fill>';
        $sx .= '</fills>';
        $sx .= '<borders count="2">';
        $sx .= '<border><left/><right/><top/><bottom/><diagonal/></border>';
        $sx .= '<border><left style="thin"><color rgb="' . $borderColor . '"/></left><right style="thin"><color rgb="' . $borderColor . '"/></right><top style="thin"><color rgb="' . $borderColor . '"/></top><bottom style="thin"><color rgb="' . $borderColor . '"/></bottom><diagonal/></border>';
        $sx .= '</borders>';
        $sx .= '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>';
        $sx .= '<cellXfs count="6">';
        $sx .= '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>';
        $sx .= '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>';
        $sx .= '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>';
        $sx .= '<xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>';
        $sx .= '<xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyBorder="1"/>';
        $sx .= '<xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>';
        $sx .= '</cellXfs>';
        $sx .= '</styleSheet>';

        $dx = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
        $dx .= '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"';
        $dx .= ' xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"';
        $dx .= ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">';
        $dx .= '<xdr:oneCellAnchor>';
        $dx .= '<xdr:from><xdr:col>0</xdr:col><xdr:colOff>38100</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>38100</xdr:rowOff></xdr:from>';
        $dx .= '<xdr:ext cx="' . ($logoCx ?? 1828800) . '" cy="' . ($logoCy ?? 495300) . '"/>';
        $dx .= '<xdr:pic>';
        $dx .= '<xdr:nvPicPr><xdr:cNvPr id="2" name="MaptechLogo"/>';
        $dx .= '<xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>';
        $dx .= '<xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>';
        $dx .= '<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="' . ($logoCx ?? 1828800) . '" cy="' . ($logoCy ?? 495300) . '"/></a:xfrm>';
        $dx .= '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>';
        $dx .= '</xdr:pic><xdr:clientData/>';
        $dx .= '</xdr:oneCellAnchor>';
        $dx .= '</xdr:wsDr>';

        $tmpFile = tempnam(sys_get_temp_dir(), 'report_xlsx_');
        $zip = new \ZipArchive();
        $zip->open($tmpFile, \ZipArchive::CREATE | \ZipArchive::OVERWRITE);

        $ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
        $ct .= '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">';
        $ct .= '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>';
        $ct .= '<Default Extension="xml" ContentType="application/xml"/>';
        if ($hasLogo) { $ct .= '<Default Extension="png" ContentType="image/png"/>'; }
        $ct .= '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>';
        $ct .= '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
        $ct .= '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>';
        if ($hasLogo) { $ct .= '<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>'; }
        $ct .= '</Types>';
        $zip->addFromString('[Content_Types].xml', $ct);

        $zip->addFromString('_rels/.rels',
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' .
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' .
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' .
            '</Relationships>'
        );

        $zip->addFromString('xl/workbook.xml',
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' .
            '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"' .
            ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' .
            '<sheets><sheet name="Reports" sheetId="1" r:id="rId1"/></sheets>' .
            '</workbook>'
        );

        $zip->addFromString('xl/_rels/workbook.xml.rels',
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' .
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' .
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' .
            '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' .
            '</Relationships>'
        );

        $zip->addFromString('xl/worksheets/sheet1.xml', $sw);
        $zip->addFromString('xl/styles.xml', $sx);

        if ($hasLogo) {
            $zip->addFromString('xl/worksheets/_rels/sheet1.xml.rels',
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' .
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' .
                '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>' .
                '</Relationships>'
            );
            $zip->addFromString('xl/drawings/drawing1.xml', $dx);
            $zip->addFromString('xl/drawings/_rels/drawing1.xml.rels',
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' .
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' .
                '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/logo.png"/>' .
                '</Relationships>'
            );
            $zip->addFromString('xl/media/logo.png', file_get_contents($logoPath));
        }

        $zip->close();

        return response()->streamDownload(function () use ($tmpFile) {
            readfile($tmpFile);
            @unlink($tmpFile);
        }, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
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

    /**
     * Regenerate recovery key for a user.
     */
    public function regenerateRecoveryKey(string $id)
    {
        try {
            $user = User::findOrFail($id);

            // Generate a new recovery key
            $recoveryKey = User::generateRecoveryKey();

            // Store both the hash and the actual key
            $user->update([
                'recovery_key_hash' => hash('sha256', $recoveryKey),
                'recovery_key' => $recoveryKey,
            ]);

            return response()->json([
                'message' => 'Recovery key regenerated successfully',
                'recovery_key' => $recoveryKey,
                'user_name' => $user->fullname,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to regenerate recovery key', [
                'user_id' => $id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Failed to regenerate recovery key: ' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get the saved recovery key for a user.
     */
    public function getRecoveryKey(string $id)
    {
        try {
            $user = User::findOrFail($id);

            if (empty($user->recovery_key)) {
                return response()->json([
                    'message' => 'No recovery key found for this user. You can regenerate one.',
                    'recovery_key' => null,
                    'user_name' => $user->fullname,
                ]);
            }

            return response()->json([
                'message' => 'Recovery key retrieved successfully',
                'recovery_key' => $user->recovery_key,
                'user_name' => $user->fullname,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to get recovery key', [
                'user_id' => $id,
                'error' => $e->getMessage(),
            ]);

            return response()->json([
                'message' => 'Failed to get recovery key: ' . $e->getMessage()
            ], 500);
        }
    }
}
