<?php

use App\Models\AuditLog;
use App\Models\Department;
use App\Models\Subdepartment;
use App\Models\TimeLog;
use App\Models\User;
use App\Support\AuditDate;
use App\Http\Controllers\LoginController;
use App\Http\Controllers\PasswordResetController;
use App\Http\Controllers\Admin\AuditLogRetentionPolicyController;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| PASSWORD RESET ROUTES
|--------------------------------------------------------------------------
| These routes handle the password reset flow with OTP verification.
| Rate limiting is handled in the controller for security.
*/

Route::prefix('password')->group(function () {
    // Send OTP to email for password reset
    Route::post('/forgot', [PasswordResetController::class, 'sendResetOTP']);

    // Verify the OTP code
    Route::post('/verify-otp', [PasswordResetController::class, 'verifyOTP']);

    // Reset password with verified token
    Route::post('/reset', [PasswordResetController::class, 'resetPassword']);

    // Resend OTP (same as forgot, but semantically different)
    Route::post('/resend-otp', [PasswordResetController::class, 'resendOTP']);

    // Reset password using recovery key (no email required)
    Route::post('/reset-with-recovery-key', [PasswordResetController::class, 'resetPasswordWithRecoveryKey']);
});

/*
|--------------------------------------------------------------------------
| DEPARTMENT ROUTES
|--------------------------------------------------------------------------
*/

Route::get('/departments', function () {
    $departments = Department::with([
        'subdepartments.headUser:id,fullname',
        'subdepartments.employee:id,fullname',
        'subdepartments.employees:id,fullname,email,department,subdepartment_id',
        'headUser:id,fullname',
    ])->get();

    return $departments->map(function (Department $department) {
        $name = strtolower(trim((string) $department->name));
        $code = strtolower(trim((string) ($department->code ?? '')));

        $acceptedDepartments = array_values(array_unique(array_filter([$name, $code])));

        $department->employee_count = User::query()
            ->whereRaw('LOWER(role) = ?', ['employee'])
            ->where(function ($q) use ($acceptedDepartments) {
                foreach ($acceptedDepartments as $dept) {
                    $q->orWhereRaw('LOWER(TRIM(department)) = ?', [$dept]);
                }
            })
            ->count();

        $department->instructor_count = User::query()
            ->whereRaw('LOWER(role) = ?', ['instructor'])
            ->where(function ($q) use ($acceptedDepartments) {
                foreach ($acceptedDepartments as $dept) {
                    $q->orWhereRaw('LOWER(TRIM(department)) = ?', [$dept]);
                }
            })
            ->count();

        return $department;
    })->values();
});

// CREATE DEPARTMENT
Route::post('/departments', function (Request $request) {

    $request->validate([
        'name' => 'required|string|max:255',
        'code' => 'required|string|max:50|unique:departments,code',
        'head_id' => 'nullable|exists:users,id',
    ]);

    if ($request->filled('head_id')) {
        $headUser = \App\Models\User::select('id', 'role')->find((int) $request->head_id);
        $headRole = strtolower((string) ($headUser?->role ?? ''));
        if (!$headUser || !in_array($headRole, ['admin', 'instructor'], true)) {
            return response()->json([
                'message' => 'Department head must be an Admin or Instructor.',
                'errors' => ['head_id' => ['Department head must be an Admin or Instructor.']]
            ], 422);
        }
    }

    return Department::create([
        'name' => $request->name,
        'code' => $request->code,
        'head' => $request->head,
        'head_id' => $request->head_id,
        'status' => $request->status ?? 'Active',
        'description' => $request->description,
        'employee_count' => 0,
        'course_count' => 0,
    ]);
});

// UPDATE DEPARTMENT
Route::put('/departments/{id}', function (Request $request, $id) {

    $department = Department::findOrFail($id);

    $request->validate([
        'name' => 'required|string|max:255',
        'code' => 'required|string|max:50',
        'head_id' => 'nullable|exists:users,id',
    ]);

    if ($request->filled('head_id')) {
        $headUser = \App\Models\User::select('id', 'role')->find((int) $request->head_id);
        $headRole = strtolower((string) ($headUser?->role ?? ''));
        if (!$headUser || !in_array($headRole, ['admin', 'instructor'], true)) {
            return response()->json([
                'message' => 'Department head must be an Admin or Instructor.',
                'errors' => ['head_id' => ['Department head must be an Admin or Instructor.']]
            ], 422);
        }
    }

    $department->update([
        'name' => $request->name,
        'code' => $request->code,
        'head' => $request->head,
        'head_id' => $request->head_id,
        'status' => $request->status,
        'description' => $request->description,
    ]);

    return $department;
});

// DELETE DEPARTMENT
Route::delete('/departments/{id}', function ($id) {

    Department::findOrFail($id)->delete();

    return response()->json([
        'message' => 'Department deleted successfully',
    ]);
});

/*
|--------------------------------------------------------------------------
| SUBDEPARTMENT ROUTES
|--------------------------------------------------------------------------
*/

// CREATE SUBDEPARTMENT
Route::post('/departments/{id}/subdepartments', function (Request $request, $id) {

    $request->validate([
        'name' => 'required|string|max:255',
        'head_id' => 'nullable|exists:users,id',
        'employee_id' => 'nullable|exists:users,id',
    ]);

    if ($request->filled('head_id')) {
        $headUser = \App\Models\User::select('id', 'role')->find((int) $request->head_id);
        $headRole = strtolower((string) ($headUser?->role ?? ''));
        if (!$headUser || !in_array($headRole, ['admin', 'instructor'], true)) {
            return response()->json([
                'message' => 'Subdepartment head must be an Admin or Instructor.',
                'errors' => ['head_id' => ['Subdepartment head must be an Admin or Instructor.']]
            ], 422);
        }
    }

    $subdepartment = Subdepartment::create([
        'department_id' => $id,
        'name' => $request->name,
        'description' => $request->description,
        'head_id' => $request->head_id,
        'employee_id' => $request->employee_id,
    ]);

    return $subdepartment->load(['headUser:id,fullname', 'employee:id,fullname', 'employees:id,fullname,email,department,subdepartment_id']);
});

// UPDATE SUBDEPARTMENT
Route::put('/subdepartments/{id}', function (Request $request, $id) {

    $subdepartment = Subdepartment::findOrFail($id);

    $request->validate([
        'name' => 'required|string|max:255',
        'head_id' => 'nullable|exists:users,id',
        'employee_id' => 'nullable|exists:users,id',
    ]);

    if ($request->filled('head_id')) {
        $headUser = \App\Models\User::select('id', 'role')->find((int) $request->head_id);
        $headRole = strtolower((string) ($headUser?->role ?? ''));
        if (!$headUser || !in_array($headRole, ['admin', 'instructor'], true)) {
            return response()->json([
                'message' => 'Subdepartment head must be an Admin or Instructor.',
                'errors' => ['head_id' => ['Subdepartment head must be an Admin or Instructor.']]
            ], 422);
        }
    }

    $subdepartment->update([
        'name' => $request->name,
        'head_id' => $request->head_id,
        'employee_id' => $request->employee_id,
    ]);

    return $subdepartment->load(['headUser:id,fullname', 'employee:id,fullname', 'employees:id,fullname,email,department,subdepartment_id']);
});

// DELETE SUBDEPARTMENT
Route::delete('/subdepartments/{id}', function ($id) {

    Subdepartment::findOrFail($id)->delete();

    return response()->json([
        'message' => 'Subdepartment deleted successfully',
    ]);
});

/*
|--------------------------------------------------------------------------
| AUTHENTICATION ROUTES
|--------------------------------------------------------------------------
*/

// API Token Login (JWT-like)
Route::post('/login', [LoginController::class, 'apiLogin']);

// Get authenticated user
Route::get('/user', [LoginController::class, 'user'])
    ->middleware(['auth:sanctum', 'status']);

// Logout
Route::post('/logout', [LoginController::class, 'logout'])
    ->middleware('auth:sanctum');

// Current user's audit logs (authenticated users)
Route::get('/me/audit-logs', function (Request $request) {
    $user = $request->user();
    if (! $user) {
        return response()->json(['message' => 'Unauthenticated'], 401);
    }

    $logs = AuditLog::where('user_id', $user->id)
        ->with('user:id,fullname,email,role,department')
        ->orderByDesc('created_at')
        ->get();

    // For each audit entry, attempt to attach the matching time_log (same logic as admin endpoint)
    $logs = $logs->map(function ($log) {
        $timeLog = null;

        // Exact deterministic linkage for newly written rows.
        if ($log->action === 'login') {
            $timeLog = TimeLog::where('login_audit_log_id', $log->id)->first();
        } elseif ($log->action === 'logout') {
            $timeLog = TimeLog::where('logout_audit_log_id', $log->id)->first();
        }

        // Legacy fallback: match by user + tight time window.
        $logAt = AuditDate::modelStorageDateTime($log, 'created_at');
        if (!$timeLog && $logAt) {
            $start = $logAt->copy()->subMinutes(2)->toDateTimeString();
            $end = $logAt->copy()->addMinutes(2)->toDateTimeString();
            if ($log->action === 'login') {
                $candidates = TimeLog::where('user_id', $log->user_id)
                    ->whereBetween('time_in', [$start, $end])
                    ->get();
                $timeLog = $candidates->sortBy(function ($tl) use ($log) {
                    if (! $tl->time_in || ! $log->created_at) {
                        return PHP_INT_MAX;
                    }

                    return abs(Carbon::parse($tl->time_in)->diffInSeconds($log->created_at, false));
                })->first();
            } elseif ($log->action === 'logout') {
                $candidates = TimeLog::where('user_id', $log->user_id)
                    ->whereBetween('time_out', [$start, $end])
                    ->get();
                $timeLog = $candidates->sortBy(function ($tl) use ($log) {
                    if (! $tl->time_out || ! $log->created_at) {
                        return PHP_INT_MAX;
                    }

                    return abs(Carbon::parse($tl->time_out)->diffInSeconds($log->created_at, false));
                })->first();
            }
        }
        $log->time_log = $timeLog;

        return $log;
    });

    // Return ISO8601 UTC timestamps and include time_log payload when available
    $data = $logs->map(function ($log) {
        return [
            'id' => $log->id,
            'user_id' => $log->user_id,
            'action' => $log->action,
            'ip_address' => $log->ip_address,
            'created_at' => AuditDate::modelFieldUtcIso($log, 'created_at'),
            'updated_at' => AuditDate::modelFieldUtcIso($log, 'updated_at'),
            'time_log' => $log->time_log ? [
                'id' => $log->time_log->id,
                'time_in' => AuditDate::modelFieldUtcIso($log->time_log, 'time_in'),
                'time_out' => AuditDate::modelFieldUtcIso($log->time_log, 'time_out'),
            ] : null,
        ];
    });

    return response()->json(['data' => $data]);
})->middleware(['auth:sanctum', 'status']);

/*
|--------------------------------------------------------------------------
| ADMIN ROUTES - Role: Admin Only
|--------------------------------------------------------------------------
*/

use App\Http\Controllers\Admin\BusinessDetailsController;
use App\Http\Controllers\Admin\CourseController as AdminCourseController;
use App\Http\Controllers\Admin\ProductLogoManagerController;
use App\Http\Controllers\Admin\QuizController as AdminQuizController;
use App\Http\Controllers\Admin\ReportController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\AnalyticsController;

// Test route for debugging
Route::get('/test-auth', function (Request $request) {
    $user = $request->user();

    return response()->json([
        'message' => 'API is working',
        'timestamp' => Carbon::now()->utc()->toIso8601String(),
        'user' => $user ? [
            'id' => $user->id,
            'name' => $user->fullname,
            'role' => $user->role,
            'status' => $user->status,
        ] : null,
    ]);
});

// Public business branding details for app sidebars
Route::get('/business-details', [BusinessDetailsController::class, 'show']);

Route::prefix('admin')->middleware(['auth:sanctum', 'status', 'role:Admin'])->group(function () {

    // Dashboard
    Route::get('/dashboard', [UserController::class, 'dashboard']);
    Route::get('/activity', [UserController::class, 'activity']);

    // Business Details
    Route::post('/business-details', [BusinessDetailsController::class, 'update']);

    // Reports & Analytics
    Route::get('/reports', [UserController::class, 'reports']);
    Route::get('/reports/export', [UserController::class, 'exportReport']);
    Route::get('/reports/analytics', [ReportController::class, 'analytics']);

    // User Management
    Route::get('/users', [UserController::class, 'index']);
    Route::post('/users', [UserController::class, 'store']);
    Route::get('/users/{id}', [UserController::class, 'show']);
    Route::put('/users/{id}', [UserController::class, 'update']);
    Route::delete('/users/{id}', [UserController::class, 'destroy']);
    Route::post('/users/{id}/restore', [UserController::class, 'restore']);
    Route::post('/users/{id}/photo', [UserController::class, 'uploadPhoto']);
    Route::get('/users/{id}/recovery-key', [UserController::class, 'getRecoveryKey']);
    Route::post('/users/{id}/regenerate-recovery-key', [UserController::class, 'regenerateRecoveryKey']);
    // Bulk archive users (accepts JSON { ids: [1,2,3] })
    Route::post('/users/bulk-delete', [UserController::class, 'bulkDelete']);

    // Course Management (Admin can manage all courses)
    Route::get('/courses', [AdminCourseController::class, 'index']);
    Route::post('/courses', [AdminCourseController::class, 'store']);
    Route::get('/courses/{id}', [AdminCourseController::class, 'show']);
    Route::put('/courses/{id}', [AdminCourseController::class, 'update']);
    Route::delete('/courses/{id}', [AdminCourseController::class, 'destroy']);
    // Bulk assign courses to an instructor
    Route::post('/courses/bulk-assign', [AdminCourseController::class, 'bulkAssign']);

    // Course Enrollment Management
    Route::get('/enrollments', [AdminCourseController::class, 'allEnrollments']);
    Route::get('/enrollments/mismatched', [AdminCourseController::class, 'mismatchedEnrollments']);
    Route::get('/courses/{id}/enrollments', [AdminCourseController::class, 'enrollments']);
    Route::get('/modules/{moduleId}/enrollment-lists', [AdminCourseController::class, 'moduleEnrollmentLists']);
    Route::post('/courses/{id}/enrollments', [AdminCourseController::class, 'enroll']);
    Route::delete('/courses/{courseId}/enrollments/{userId}', [AdminCourseController::class, 'unenroll']);
    Route::post('/courses/{courseId}/enrollments/{userId}/lock', [AdminCourseController::class, 'lockEnrollment']);
    Route::post('/courses/{courseId}/enrollments/{userId}/unlock', [AdminCourseController::class, 'unlockEnrollment']);

    // Per-module lock/unlock for a specific user (admin)
    Route::post('/courses/{courseId}/modules/{moduleId}/enrollments/{userId}/lock', [AdminCourseController::class, 'lockModule']);
    Route::post('/courses/{courseId}/modules/{moduleId}/enrollments/{userId}/unlock', [AdminCourseController::class, 'unlockModule']);

    // Course Module Management
    Route::post('/courses/{id}/modules', [AdminCourseController::class, 'addModule']);
    Route::put('/courses/{courseId}/modules/{moduleId}', [AdminCourseController::class, 'updateModule']);
    Route::delete('/courses/{courseId}/modules/{moduleId}', [AdminCourseController::class, 'deleteModule']);
    Route::post('/courses/{courseId}/modules/reorder', [AdminCourseController::class, 'reorderModules']);

    // Product Logo Manager (one active logo per course)
    Route::get('/product-logos/courses', [ProductLogoManagerController::class, 'index']);
    Route::post('/product-logos/courses/{course}/logo', [ProductLogoManagerController::class, 'upload']);
    Route::patch('/product-logos/courses/{course}/logo', [ProductLogoManagerController::class, 'updateName']);
    Route::delete('/product-logos/courses/{course}/logo', [ProductLogoManagerController::class, 'destroy']);

    // Lesson Management
    Route::post('/modules/{moduleId}/lessons', [AdminCourseController::class, 'addLesson']);
    Route::post('/modules/{moduleId}/lessons/{lessonId}', [AdminCourseController::class, 'updateLesson']);
    Route::delete('/modules/{moduleId}/lessons/{lessonId}', [AdminCourseController::class, 'deleteLesson']);
    Route::post('/modules/{moduleId}/lessons/reorder', [AdminCourseController::class, 'reorderLessons']);

    // Quiz Management
    Route::get('/quizzes', [AdminQuizController::class, 'index']);
    Route::get('/quiz-attempts', [AdminQuizController::class, 'attempts']);
    Route::get('/courses/{courseId}/quizzes', [AdminQuizController::class, 'forCourse']);
    Route::post('/courses/{courseId}/quizzes', [AdminQuizController::class, 'store']);
    Route::get('/modules/{moduleId}/quizzes', [AdminQuizController::class, 'forModule']);
    Route::post('/modules/{moduleId}/quizzes', [AdminQuizController::class, 'storeForModule']);
    Route::get('/quizzes/{id}', [AdminQuizController::class, 'show']);
    Route::put('/quizzes/{id}', [AdminQuizController::class, 'update']);
    Route::delete('/quizzes/{id}', [AdminQuizController::class, 'destroy']);
    Route::post('/quizzes/{quizId}/questions', [AdminQuizController::class, 'addQuestion']);
    Route::put('/quizzes/{quizId}/questions/{questionId}', [AdminQuizController::class, 'updateQuestion']);
    Route::delete('/quizzes/{quizId}/questions/{questionId}', [AdminQuizController::class, 'deleteQuestion']);

    // Q&A (Admin)
    Route::get('/lessons', [\App\Http\Controllers\QAController::class, 'adminLessons']);
    Route::get('/questions', [\App\Http\Controllers\QAController::class, 'adminIndex']);
    Route::delete('/questions/{id}', [\App\Http\Controllers\QAController::class, 'adminDestroy']);
    Route::post('/questions/{id}/answer', [\App\Http\Controllers\QAController::class, 'adminAnswer']);
    Route::delete('/questions/{id}/answer', [\App\Http\Controllers\QAController::class, 'adminDeleteAnswer']);
    Route::post('/questions/{id}/replies', [\App\Http\Controllers\QAController::class, 'storeReply']);
    Route::delete('/questions/{questionId}/replies/{replyId}', [\App\Http\Controllers\QAController::class, 'destroyReply']);
    Route::post('/questions/{questionId}/replies/{replyId}/reactions', [\App\Http\Controllers\QAController::class, 'toggleReaction']);

    // Audit Logs (stable query path)
    Route::get('/audit-logs', function (Request $request) {
        $roleFilter = null;
        if ($request->filled('role')) {
            $roleFilter = strtolower($request->input('role'));
            if (! in_array($roleFilter, ['admin', 'instructor', 'employee'])) {
                return response()->json(['message' => 'Invalid role filter'], 422);
            }
        }

        $perPage = max(1, min(200, (int) $request->input('per_page', 50)));
        $page = max(1, (int) $request->input('page', 1));

        try {
            $query = \Illuminate\Support\Facades\DB::table('audit_logs as a')
                ->leftJoin('users as u', 'u.id', '=', 'a.user_id')
                ->whereNull('a.deleted_at')
                ->select([
                    'a.id',
                    'a.user_id',
                    'a.action',
                    'a.ip_address',
                    'a.created_at',
                    'u.id as user_ref_id',
                    'u.fullname as user_fullname',
                    'u.email as user_email',
                    'u.role as user_role',
                    'u.department as user_department',
                ]);

            if ($roleFilter) {
                $query->whereRaw('LOWER(u.role) = ?', [$roleFilter]);
            }

            if ($request->filled('user_id')) {
                $query->where('a.user_id', (int) $request->input('user_id'));
            }
            $paginator = $query
                ->orderByDesc('a.created_at')
                ->paginate($perPage, ['*'], 'page', $page);

            $data = collect($paginator->items())->map(function ($row) {
                $createdAt = null;
                if (!empty($row->created_at)) {
                    try {
                        $createdAt = Carbon::parse($row->created_at)->setTimezone('UTC')->toIso8601String();
                    } catch (\Throwable $e) {
                        $createdAt = (string) $row->created_at;
                    }
                }

                // Attempt to attach the associated TimeLog record (if any). Prefer explicit linkage
                // via login_audit_log_id / logout_audit_log_id so the frontend can display Actual Time In/Out.
                $timeLog = null;
                try {
                    $timeLog = \App\Models\TimeLog::where('login_audit_log_id', $row->id)
                        ->orWhere('logout_audit_log_id', $row->id)
                        ->first();
                } catch (\Throwable $e) {
                    // ignore lookup failures; time_log will remain null
                }

                // Legacy fallback: when explicit audit log linkage is missing, try matching by user_id
                // within a ±2 minute window of the audit event. This helps for older records.
                if (! $timeLog && ! empty($row->user_id) && ! empty($row->created_at)) {
                    try {
                        $logAt = Carbon::parse($row->created_at);
                        $start = $logAt->copy()->subMinutes(2)->toDateTimeString();
                        $end = $logAt->copy()->addMinutes(2)->toDateTimeString();
                        if ($row->action === 'login') {
                            $candidates = \App\Models\TimeLog::where('user_id', $row->user_id)
                                ->whereBetween('time_in', [$start, $end])
                                ->get();
                            $timeLog = $candidates->sortBy(function ($tl) use ($logAt) {
                                if (! $tl->time_in) return PHP_INT_MAX;
                                return abs(Carbon::parse($tl->time_in)->diffInSeconds($logAt, false));
                            })->first();
                        } elseif ($row->action === 'logout') {
                            $candidates = \App\Models\TimeLog::where('user_id', $row->user_id)
                                ->whereBetween('time_out', [$start, $end])
                                ->get();
                            $timeLog = $candidates->sortBy(function ($tl) use ($logAt) {
                                if (! $tl->time_out) return PHP_INT_MAX;
                                return abs(Carbon::parse($tl->time_out)->diffInSeconds($logAt, false));
                            })->first();
                        }
                    } catch (\Throwable $e) {
                        // ignore fallback errors
                    }
                }

                return [
                    'id' => $row->id,
                    'user_id' => $row->user_id,
                    'action' => $row->action,
                    'ip_address' => $row->ip_address,
                    'created_at' => $createdAt,
                    'user' => $row->user_ref_id ? [
                        'id' => $row->user_ref_id,
                        'fullname' => $row->user_fullname,
                        'email' => $row->user_email,
                        'role' => $row->user_role,
                        'department' => $row->user_department,
                    ] : null,
                    'time_log' => $timeLog ? [
                        'id' => $timeLog->id,
                        'time_in' => \App\Support\AuditDate::modelFieldUtcIso($timeLog, 'time_in'),
                        'time_out' => \App\Support\AuditDate::modelFieldUtcIso($timeLog, 'time_out'),
                    ] : null,
                ];
            })->values();

            return response()->json([
                'data' => $data,
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'total' => $paginator->total(),
                'per_page' => $paginator->perPage(),
            ]);
        } catch (\Throwable $e) {
            Log::error('Admin audit logs stable query failed', [
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);

            $errorDetail = config('app.debug')
                ? $e->getMessage()
                : 'Audit logs are temporarily unavailable.';

            return response()->json([
                'data' => [],
                'current_page' => $page,
                'last_page' => 1,
                'total' => 0,
                'per_page' => $perPage,
                'message' => $errorDetail,
            ], 500);
        }
    });

    // Audit log retention policy
    Route::get('/audit-log-retention-policy', [AuditLogRetentionPolicyController::class, 'show']);
    Route::put('/audit-log-retention-policy', [AuditLogRetentionPolicyController::class, 'update']);

    // Export Audit Logs to CSV
    Route::get('/audit-logs/export', function (Request $request) {
        $roleFilter = null;
        if ($request->filled('role')) {
            $roleFilter = strtolower($request->input('role'));
            if (! in_array($roleFilter, ['admin', 'instructor', 'employee'])) {
                return response()->json(['message' => 'Invalid role filter'], 422);
            }
        }

        $format = $request->input('format', 'csv'); // csv, excel, or pdf
        if (!in_array($format, ['csv', 'excel', 'pdf'])) {
            $format = 'csv';
        }

        // Period filter: weekly, monthly, yearly (optional)
        $period = $request->input('period');
        if ($period !== null && !in_array($period, ['weekly', 'monthly', 'yearly'])) {
            return response()->json(['message' => 'Invalid period filter'], 422);
        }

        try {
            $query = \Illuminate\Support\Facades\DB::table('audit_logs as a')
                ->leftJoin('users as u', 'u.id', '=', 'a.user_id')
                ->whereNull('a.deleted_at')
                ->select([
                    'a.id',
                    'a.user_id',
                    'a.action',
                    'a.ip_address',
                    'a.created_at',
                    'u.fullname as user_fullname',
                    'u.email as user_email',
                    'u.role as user_role',
                    'u.department as user_department',
                ]);

            if ($roleFilter !== null) {
                $query->where(\Illuminate\Support\Facades\DB::raw('LOWER(u.role)'), $roleFilter);
            }

            // Apply period filter if provided
            if ($period) {
                $now = \Carbon\Carbon::now();
                if ($period === 'weekly') {
                    $start = $now->copy()->startOfWeek();
                } elseif ($period === 'monthly') {
                    $start = $now->copy()->startOfMonth();
                } else { // yearly
                    $start = $now->copy()->startOfYear();
                }
                $query->where('a.created_at', '>=', $start->toDateTimeString());
            }

            $logs = $query->orderByDesc('a.created_at')->limit(10000)->get();
            $logs = $logs->reject(function ($log) {
                return preg_match('/_exported$/i', (string) ($log->action ?? ''));
            })->values();
            $timestamp = date('Y-m-d_His');

            // CSV Export
            if ($format === 'csv') {
                $filename = 'audit_logs_' . $timestamp . '.csv';

                $callback = function() use ($logs) {
                    $file = fopen('php://output', 'w');

                    // Add BOM for Excel UTF-8 compatibility
                    fprintf($file, chr(0xEF).chr(0xBB).chr(0xBF));

                    // CSV Headers
                    fputcsv($file, ['ID', 'User ID', 'Full Name', 'Email', 'Role', 'Department', 'Action', 'IP Address', 'Date & Time']);

                    foreach ($logs as $log) {
                        fputcsv($file, [
                            $log->id,
                            $log->user_id,
                            $log->user_fullname ?? '',
                            $log->user_email ?? '',
                            $log->user_role ?? '',
                            $log->user_department ?? '',
                            $log->action,
                            $log->ip_address ?? '',
                            $log->created_at ?? '',
                        ]);
                    }

                    fclose($file);
                };

                return response()->stream($callback, 200, [
                    'Content-Type' => 'text/csv',
                    'Content-Disposition' => 'attachment; filename="' . $filename . '"',
                ]);
            }

            // Excel Export — real XLSX (OpenXML / ZIP) so Excel opens it without warnings
            if ($format === 'excel') {
                if (!class_exists('ZipArchive')) {
                    return response()->json(['message' => 'Server is missing the PHP zip extension. Please contact the administrator.'], 500);
                }
                $filename  = 'audit_logs_' . $timestamp . '.xlsx';
                $roleLabel = $roleFilter ? ucfirst($roleFilter) . ' ' : '';
                $logoPath  = public_path('assets/Maptech-Official-Logo.png');
                $hasLogo   = file_exists($logoPath);
                $genInfo   = 'Generated: ' . date('F j, Y g:i A') . '  |  Total Records: ' . count($logs);
                $logoCx = null;
                $logoCy = null;
                if ($hasLogo) {
                    $logoDims = @getimagesize($logoPath);
                    $logoWidthPx = (int) ($logoDims[0] ?? 0);
                    $logoHeightPx = (int) ($logoDims[1] ?? 0);
                    $maxWidthPx = 200;
                    $maxHeightPx = 40;
                    if ($logoWidthPx > 0 && $logoHeightPx > 0) {
                        $scale = min($maxWidthPx / $logoWidthPx, $maxHeightPx / $logoHeightPx, 1);
                        $scaledWidth = (int) round($logoWidthPx * $scale);
                        $scaledHeight = (int) round($logoHeightPx * $scale);
                        $logoCx = $scaledWidth * 9525;
                        $logoCy = $scaledHeight * 9525;
                    }
                }

                // XML-escape helper
                $xe = fn($s) => htmlspecialchars((string) $s, ENT_XML1, 'UTF-8');

                // Column definitions
                $headers    = ['ID','User ID','Full Name','Email','Role','Department','Action','IP Address','Date & Time'];
                $colLetters = ['A','B','C','D','E','F','G','H','I'];
                $colWidths  = [8, 8, 20, 28, 12, 22, 15, 14, 22];

                // ── Worksheet XML ─────────────────────────────────────────────────────
                // Layout: Row 1 = logo area (tall), Row 2 = title, Row 3 = meta,
                //         Row 4 = column headers, Row 5+ = data
                $sw  = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
                $sw .= '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
                $sw .= ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">';
                $sw .= '<sheetFormatPr defaultRowHeight="15"/>';
                $sw .= '<cols>';
                foreach ($colWidths as $i => $w) {
                    $sw .= '<col min="'.($i+1).'" max="'.($i+1).'" width="'.$w.'" customWidth="1"/>';
                }
                $sw .= '</cols>';
                $sw .= '<sheetData>';
                // Row 1: logo placeholder row (tall to accommodate drawing)
                $sw .= '<row r="1" ht="50" customHeight="1"/>';
                // Row 2: title (merged across all columns)
                $sw .= '<row r="2" ht="22" customHeight="1">';
                $sw .= '<c r="A2" s="1" t="inlineStr"><is><t>'.$xe($roleLabel.'Audit Logs Report').'</t></is></c>';
                $sw .= '</row>';
                // Row 3: generated info
                $sw .= '<row r="3" ht="14" customHeight="1">';
                $sw .= '<c r="A3" s="2" t="inlineStr"><is><t>'.$xe($genInfo).'</t></is></c>';
                $sw .= '</row>';
                // Row 4: column headers
                $sw .= '<row r="4" ht="18" customHeight="1">';
                foreach ($colLetters as $i => $letter) {
                    $sw .= '<c r="'.$letter.'4" s="3" t="inlineStr"><is><t>'.$xe($headers[$i]).'</t></is></c>';
                }
                $sw .= '</row>';
                // Data rows
                $rowNum = 5;
                foreach ($logs as $log) {
                    $s  = ($rowNum % 2 === 0) ? 5 : 4; // alternate row shading
                    $sw .= '<row r="'.$rowNum.'">';
                    $vals = [
                        (string) $log->id,
                        (string) $log->user_id,
                        $log->user_fullname   ?? '',
                        $log->user_email      ?? '',
                        $log->user_role       ?? '',
                        $log->user_department ?? '',
                        $log->action          ?? '',
                        $log->ip_address      ?? '',
                        $log->created_at      ?? '',
                    ];
                    foreach ($colLetters as $i => $letter) {
                        $sw .= '<c r="'.$letter.$rowNum.'" s="'.$s.'" t="inlineStr"><is><t>'.$xe($vals[$i]).'</t></is></c>';
                    }
                    $sw .= '</row>';
                    $rowNum++;
                }
                $sw .= '</sheetData>';
                // Merge title and meta rows across all 9 columns
                $sw .= '<mergeCells count="2"><mergeCell ref="A2:I2"/><mergeCell ref="A3:I3"/></mergeCells>';
                if ($hasLogo) { $sw .= '<drawing r:id="rId1"/>'; }
                $sw .= '</worksheet>';

                // ── Styles XML ────────────────────────────────────────────────────────
                $sx  = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
                $sx .= '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
                // Fonts: 0=default, 1=title bold green, 2=meta grey, 3=header white bold, 4=data
                $sx .= '<fonts count="5">';
                $sx .= '<font><sz val="11"/><name val="Calibri"/></font>';
                $sx .= '<font><b/><sz val="14"/><color rgb="FF0B5F2A"/><name val="Calibri"/></font>';
                $sx .= '<font><sz val="10"/><color rgb="FF555555"/><name val="Calibri"/></font>';
                $sx .= '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>';
                $sx .= '<font><sz val="11"/><name val="Calibri"/></font>';
                $sx .= '</fonts>';
                // Fills: 0=none(req), 1=gray125(req), 2=brand header, 3=light green striped row
                $sx .= '<fills count="4">';
                $sx .= '<fill><patternFill patternType="none"/></fill>';
                $sx .= '<fill><patternFill patternType="gray125"/></fill>';
                $sx .= '<fill><patternFill patternType="solid"><fgColor rgb="FF1B8F3A"/></patternFill></fill>';
                $sx .= '<fill><patternFill patternType="solid"><fgColor rgb="FFE8F6ED"/></patternFill></fill>';
                $sx .= '</fills>';
                // Borders: 0=none, 1=thin light grey all sides
                $sx .= '<borders count="2">';
                $sx .= '<border><left/><right/><top/><bottom/><diagonal/></border>';
                $sx .= '<border><left style="thin"><color rgb="FFCCE5D4"/></left><right style="thin"><color rgb="FFCCE5D4"/></right><top style="thin"><color rgb="FFCCE5D4"/></top><bottom style="thin"><color rgb="FFCCE5D4"/></bottom><diagonal/></border>';
                $sx .= '</borders>';
                $sx .= '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>';
                // cellXfs: 0=default,1=title,2=meta,3=col header,4=data odd,5=data even
                $sx .= '<cellXfs count="6">';
                $sx .= '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>';
                $sx .= '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>';
                $sx .= '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>';
                $sx .= '<xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>';
                $sx .= '<xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyBorder="1"/>';
                $sx .= '<xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyFill="1" applyBorder="1"/>';
                $sx .= '</cellXfs>';
                $sx .= '</styleSheet>';

                // ── Drawing XML (logo image anchored to cell A1) ──────────────────────
                $dx  = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
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

                // ── Assemble XLSX ZIP ─────────────────────────────────────────────────
                $tmpFile = tempnam(sys_get_temp_dir(), 'audit_xlsx_');
                $zip = new \ZipArchive();
                $zip->open($tmpFile, \ZipArchive::CREATE | \ZipArchive::OVERWRITE);

                // [Content_Types].xml
                $ct  = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
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

                // _rels/.rels
                $zip->addFromString('_rels/.rels',
                    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'.
                    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'.
                    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'.
                    '</Relationships>'
                );

                // xl/workbook.xml
                $zip->addFromString('xl/workbook.xml',
                    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'.
                    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"'.
                    ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'.
                    '<sheets><sheet name="Audit Logs" sheetId="1" r:id="rId1"/></sheets>'.
                    '</workbook>'
                );

                // xl/_rels/workbook.xml.rels
                $zip->addFromString('xl/_rels/workbook.xml.rels',
                    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'.
                    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'.
                    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'.
                    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'.
                    '</Relationships>'
                );

                $zip->addFromString('xl/worksheets/sheet1.xml', $sw);
                $zip->addFromString('xl/styles.xml', $sx);

                if ($hasLogo) {
                    $zip->addFromString('xl/worksheets/_rels/sheet1.xml.rels',
                        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'.
                        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'.
                        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/>'.
                        '</Relationships>'
                    );
                    $zip->addFromString('xl/drawings/drawing1.xml', $dx);
                    $zip->addFromString('xl/drawings/_rels/drawing1.xml.rels',
                        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'.
                        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'.
                        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/logo.png"/>'.
                        '</Relationships>'
                    );
                    $zip->addFromString('xl/media/logo.png', file_get_contents($logoPath));
                }

                $zip->close();
                $xlsxContent = file_get_contents($tmpFile);
                @unlink($tmpFile);

                return response($xlsxContent, 200, [
                    'Content-Type'        => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'Content-Disposition' => 'attachment; filename="' . $filename . '"',
                    'Content-Length'      => strlen($xlsxContent),
                ]);
            }

            // PDF Export (render the report layout directly so it matches the reference PDF)
            if ($format === 'pdf') {
                $filename = 'audit_logs_' . $timestamp . '.pdf';
                $logoPath = public_path('assets/Maptech-Official-Logo.png');
                $logoBase64 = file_exists($logoPath)
                    ? 'data:image/png;base64,' . base64_encode(file_get_contents($logoPath))
                    : null;

                $appTimezone = (string) config('app.timezone', 'UTC');
                $appTimezone = $appTimezone !== '' ? $appTimezone : 'UTC';

                $formatDate = function ($value) use ($appTimezone) {
                    if (empty($value)) {
                        return '';
                    }

                    try {
                        return \Carbon\Carbon::parse($value, $appTimezone)->setTimezone($appTimezone)->format('M j, Y h:i A');
                    } catch (\Throwable $e) {
                        return (string) $value;
                    }
                };

                $actionToEntity = function ($action) {
                    $action = strtolower((string) $action);
                    if ($action === '') {
                        return 'audit';
                    }

                    $parts = preg_split('/[._]/', $action, 2);
                    return $parts[0] ?: 'audit';
                };

                $displayActor = function ($log) {
                    $action = strtolower((string) ($log->action ?? ''));
                    if (empty($log->user_id) || str_starts_with($action, 'auth.login_failed')) {
                        return 'System';
                    }

                    return 'User #' . $log->user_id;
                };

                $displayActivity = function ($log) use ($actionToEntity) {
                    $entity = $actionToEntity($log->action ?? '');
                    $suffix = !empty($log->user_id) && !str_starts_with(strtolower((string) ($log->action ?? '')), 'budget_report')
                        ? $log->user_id
                        : 0;

                    return $entity . ' #' . $suffix;
                };

                $displayDetails = function ($log) {
                    $context = [];

                    if (!empty($log->user_email)) {
                        $context['email'] = $log->user_email;
                    }

                    if (!empty($log->user_department)) {
                        $context['department'] = $log->user_department;
                    }

                    if (!empty($log->ip_address)) {
                        $context['ip'] = $log->ip_address;
                    }

                    if (!empty($log->session_key)) {
                        $context['session_key'] = $log->session_key;
                    }

                    if (empty($context)) {
                        return 'context={}';
                    }

                    return 'context=' . json_encode($context, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
                };

                $totalLogs = count($logs);
                $sensitiveLogs = 0;
                $actions = [];
                $userIds = [];

                foreach ($logs as $log) {
                    $actions[] = (string) ($log->action ?? '');
                    if (!empty($log->user_id)) {
                        $userIds[] = (string) $log->user_id;
                    }
                    if (preg_match('/failed|export|delete|password|reset|permission/i', (string) ($log->action ?? ''))) {
                        $sensitiveLogs++;
                    }
                }

                $uniqueActions = count(array_unique(array_filter($actions, fn ($action) => $action !== '')));
                $usersInvolved = count(array_unique(array_filter($userIds, fn ($userId) => $userId !== '')));
                $reportTitle = $period === 'weekly'
                    ? 'Weekly Audit Logs Report'
                    : ($period === 'monthly'
                        ? 'Monthly Audit Logs Report'
                        : ($period === 'yearly' ? 'Yearly Audit Logs Report' : 'Audit Logs Report'));
                $headerRange = $totalLogs > 0
                    ? $formatDate($logs->last()->created_at) . ' - ' . $formatDate($logs->first()->created_at)
                    : 'No records available';
                $generatedAt = \Carbon\Carbon::now($appTimezone)->format('M j, Y h:i A');
                $searchValue = 'None';
                $actionValue = 'All';
                $entityValue = 'All';
                $projectValue = 'All';

                $escape = fn ($value) => htmlspecialchars((string) $value, ENT_QUOTES, 'UTF-8');

                $html = '<!DOCTYPE html><html><head><meta charset="UTF-8">';
                $html .= '<title>Audit Logs Report</title>';
                $html .= '<style>';
                $html .= '@page { size: A4 portrait; margin: 12mm 10mm 16mm 10mm; }';
                $html .= 'body { margin: 0; font-family: "Segoe UI", Arial, sans-serif; color: #24302a; background: #ffffff; }';
                $html .= '.header { position: fixed; top: 0; left: 0; right: 0; height: 34mm; background: #fff; z-index: 10; padding: 6mm 10mm 0 10mm; box-sizing: border-box; }';
                $html .= '.header-table { width: 100%; border-collapse: collapse; table-layout: fixed; }';
                $html .= '.header-table td { vertical-align: middle; }';
                $html .= '.header-left { width: 22%; text-align: left; }';
                $html .= '.header-center { width: 56%; text-align: center; }';
                $html .= '.header-right { width: 22%; text-align: right; font-size: 10px; color: #66756d; line-height: 1.35; }';
                $html .= '.brand img { max-width: 105px; max-height: 38px; display: block; }';
                $html .= '.title { margin: 0; font-size: 22px; line-height: 1.05; color: #1f5540; font-weight: 700; }';
                $html .= '.subtitle { margin: 3px 0 0 0; font-size: 12px; color: #1f5540; font-weight: 700; }';
                $html .= '.range { margin-top: 2px; font-size: 10px; color: #7a8b81; }';
                $html .= '.header-rule { border-bottom: 2px solid #215a3e; margin-top: 4mm; }';
                $html .= '.footer { position: fixed; bottom: 0; left: 0; right: 0; height: 10mm; background: #fff; z-index: 10; padding: 2mm 10mm 0 10mm; box-sizing: border-box; border-top: 1px solid #d9e1dc; font-size: 10px; color: #66756d; }';
                $html .= '.footer-table { width: 100%; border-collapse: collapse; table-layout: fixed; }';
                $html .= '.footer-table td { width: 33.333%; vertical-align: middle; }';
                $html .= '.footer-left { text-align: left; }';
                $html .= '.footer-center { text-align: center; }';
                $html .= '.footer-right { text-align: right; }';
                $html .= '.content { margin: 40mm 0 14mm 0; padding: 0 10mm; }';
                $html .= '.stats, .filters { width: 100%; border-collapse: collapse; table-layout: fixed; }';
                $html .= '.stats th { background: #1f5a43; color: #fff; font-size: 11px; letter-spacing: .2px; text-transform: uppercase; padding: 9px 10px; text-align: left; }';
                $html .= '.stats td { background: #fff; padding: 10px 10px 12px 10px; }';
                $html .= '.pill { display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 20px; border-radius: 999px; padding: 0 6px; font-size: 11px; font-weight: 700; }';
                $html .= '.pill-green { background: #e8f8eb; color: #25a06a; }';
                $html .= '.pill-red { background: #fdeaea; color: #d95a5a; }';
                $html .= '.pill-yellow { background: #fff5d6; color: #ca9d1d; }';
                $html .= '.pill-blue { background: #e8f0fe; color: #4680d4; }';
                $html .= '.filters th { background: #1f5a43; color: #fff; font-size: 11px; text-transform: uppercase; padding: 8px 10px; text-align: left; }';
                $html .= '.filters td { padding: 11px 10px 12px 10px; font-size: 11px; color: #36443d; border-bottom: 1px solid #e6ece8; }';
                $html .= '.filters .value { display: block; margin-top: 7px; color: #557164; font-size: 12px; }';
                $html .= '.section-title { margin: 14px 0 6px 0; padding: 0 0 6px 0; font-size: 17px; color: #263630; font-weight: 700; border-bottom: 1px solid #d6ddd9; }';
                $html .= '.entries { width: 100%; border-collapse: collapse; table-layout: fixed; }';
                $html .= '.entries th { background: #1f5a43; color: #fff; font-size: 10px; text-transform: uppercase; padding: 7px 6px; text-align: left; }';
                $html .= '.entries td { padding: 8px 6px; font-size: 9px; line-height: 1.25; color: #34433c; border-bottom: 1px solid #e6ece8; vertical-align: top; word-break: break-word; overflow-wrap: anywhere; white-space: normal; }';
                $html .= '.entries tr:nth-child(even) td { background: #f7fbf8; }';
                $html .= '.muted { color: #6d7d75; }';
                $html .= '.nowrap { white-space: nowrap; }';
                $html .= '.col-date { width: 11%; }';
                $html .= '.col-entity { width: 10%; }';
                $html .= '.col-activity { width: 13%; }';
                $html .= '.col-action { width: 13%; }';
                $html .= '.col-actor { width: 11%; }';
                $html .= '.col-project { width: 8%; }';
                $html .= '.col-details { width: 34%; }';
                $html .= '.page-break { page-break-after: always; }';
                $html .= '</style></head><body>';
                $html .= '<div class="header">';
                $html .= '<table class="header-table"><tr>';
                $html .= '<td class="header-left">';
                if ($logoBase64) {
                    $html .= '<div class="brand"><img src="' . $logoBase64 . '" alt="Maptech Logo"></div>';
                }
                $html .= '</td>';
                $html .= '<td class="header-center">';
                $html .= '<h1 class="title">Audit Logs Report</h1>';
                $html .= '<div class="subtitle">' . $escape($reportTitle) . '</div>';
                $html .= '<div class="range">' . $escape($headerRange) . ' &mdash; Generated on ' . $escape($generatedAt) . '</div>';
                $html .= '</td>';
                $html .= '<td class="header-right">';
                $html .= '<div>Generated: ' . $escape($generatedAt) . '</div>';
                $html .= '<div>Total Records: ' . $escape($totalLogs) . '</div>';
                $html .= '</td>';
                $html .= '</tr></table>';
                $html .= '<div class="header-rule"></div>';
                $html .= '</div>';

                $html .= '<div class="footer">';
                $html .= '<table class="footer-table"><tr>';
                $html .= '<td class="footer-left">Audit Logs</td>';
                $html .= '<td class="footer-center">Generated by Maptech</td>';
                $html .= '<td class="footer-right">Page <span class="page-number"></span></td>';
                $html .= '</tr></table>';
                $html .= '</div>';

                $html .= '<div class="content">';

                $html .= '<table class="stats"><tr>';
                $html .= '<th>Total Logs</th><th>Sensitive Logs</th><th>Unique Actions</th><th>Users Involved</th>';
                $html .= '</tr><tr>';
                $html .= '<td><span class="pill pill-green">' . $escape($totalLogs) . '</span></td>';
                $html .= '<td><span class="pill pill-red">' . $escape($sensitiveLogs) . '</span></td>';
                $html .= '<td><span class="pill pill-yellow">' . $escape($uniqueActions) . '</span></td>';
                $html .= '<td><span class="pill pill-blue">' . $escape($usersInvolved) . '</span></td>';
                $html .= '</tr></table>';

                $html .= '<table class="filters"><tr>';
                $html .= '<th>Search</th><th>Action</th><th>Entity</th><th>Project</th>';
                $html .= '</tr><tr>';
                $html .= '<td><span class="value">' . $escape($searchValue) . '</span></td>';
                $html .= '<td><span class="value">' . $escape($actionValue) . '</span></td>';
                $html .= '<td><span class="value">' . $escape($entityValue) . '</span></td>';
                $html .= '<td><span class="value">' . $escape($projectValue) . '</span></td>';
                $html .= '</tr></table>';

                $html .= '<div class="section-title">Audit Entries</div>';
                $html .= '<table class="entries">';
                $html .= '<tr>';
                $html .= '<th class="col-date">Date</th>';
                $html .= '<th class="col-entity">Entity</th>';
                $html .= '<th class="col-activity">Activity</th>';
                $html .= '<th class="col-action">Action</th>';
                $html .= '<th class="col-actor">Actor</th>';
                $html .= '<th class="col-project">Project</th>';
                $html .= '<th class="col-details">Details</th>';
                $html .= '</tr>';

                foreach ($logs as $log) {
                    $html .= '<tr>';
                    $html .= '<td class="nowrap">' . $escape($formatDate($log->created_at)) . '</td>';
                    $html .= '<td>' . $escape($actionToEntity($log->action ?? '')) . '</td>';
                    $html .= '<td>' . $escape($displayActivity($log)) . '</td>';
                    $html .= '<td>' . $escape($log->action ?? '') . '</td>';
                    $html .= '<td>' . $escape($displayActor($log)) . '</td>';
                    $html .= '<td>Global</td>';
                    $html .= '<td>' . $escape($displayDetails($log)) . '</td>';
                    $html .= '</tr>';
                }

                $html .= '</table>';
                $html .= '</div>';
                $html .= '<script type="text/php">';
                $html .= 'if (isset($pdf)) {';
                $html .= '    $font = $fontMetrics->get_font("Helvetica", "normal");';
                $html .= '    $pdf->page_text(520, 810, "Page {PAGE_NUM} of {PAGE_COUNT}", $font, 8, array(102, 117, 109));';
                $html .= '}';
                $html .= '</script>';
                $html .= '</body></html>';

                if (class_exists('\\Dompdf\\Dompdf')) {
                    try {
                        $dompdf = new \Dompdf\Dompdf();
                        $dompdf->setPaper('A4', 'portrait');
                        $dompdf->loadHtml($html);
                        $dompdf->render();
                        $pdfOutput = $dompdf->output();

                        return response($pdfOutput, 200, [
                            'Content-Type' => 'application/pdf',
                            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
                            'Content-Length' => strlen($pdfOutput),
                        ]);
                    } catch (\Throwable $e) {
                        // Fall back to HTML if the PDF renderer is unavailable.
                    }
                }

                return response($html, 200, [
                    'Content-Type' => 'text/html',
                    'Content-Disposition' => 'inline; filename="' . $filename . '"',
                ]);
            }

        } catch (\Exception $e) {
            return response()->json(['message' => 'Export failed: ' . $e->getMessage()], 500);
        }
    });

    // ==========================================
    // AUDIT LOG DELETION DISABLED
    // ==========================================
    // Audit logs are immutable and cannot be deleted for compliance and security reasons.
    // The following routes have been disabled:
    // - POST /audit-logs/bulk-delete
    // - POST /audit-logs/bulk-delete-by-users
    // - GET /audit-logs/recently-deleted
    // - POST /audit-logs/{id}/restore
    // - DELETE /audit-logs/{id}/permanent

    // Notification Management (Admin)
    Route::prefix('notifications')->group(function () {
        Route::get('/', [\App\Http\Controllers\NotificationController::class, 'index']);
        Route::get('/unread-count', [\App\Http\Controllers\NotificationController::class, 'unreadCount']);
        Route::get('/sent-history', [\App\Http\Controllers\NotificationController::class, 'getSentAnnouncements']);
        Route::get('/recently-deleted', [\App\Http\Controllers\NotificationController::class, 'getRecentlyDeleted']);
        Route::post('/sent-history/{id}/restore', [\App\Http\Controllers\NotificationController::class, 'restoreSentHistory']);
        Route::delete('/sent-history/{id}', [\App\Http\Controllers\NotificationController::class, 'deleteSentHistory']);
        Route::delete('/sent-history/{id}/permanent', [\App\Http\Controllers\NotificationController::class, 'permanentlyDeleteSentHistory']);
        Route::post('/{id}/read', [\App\Http\Controllers\NotificationController::class, 'markAsRead']);
        Route::post('/read-all', [\App\Http\Controllers\NotificationController::class, 'markAllAsRead']);
        Route::delete('/{id}', [\App\Http\Controllers\NotificationController::class, 'destroy']);
        Route::post('/{id}/restore', [\App\Http\Controllers\NotificationController::class, 'restoreNotification']);
        Route::delete('/{id}/permanent', [\App\Http\Controllers\NotificationController::class, 'permanentlyDeleteNotification']);
        Route::post('/announce', [\App\Http\Controllers\NotificationController::class, 'adminAnnounce']);
        Route::post('/notify-user', [\App\Http\Controllers\NotificationController::class, 'adminNotifyUser']);
    });

    // Admin: view lesson feedbacks by department/course/lesson
    Route::get('/feedbacks', [\App\Http\Controllers\Admin\FeedbackController::class, 'index']);
    Route::delete('/feedbacks/{id}', [\App\Http\Controllers\Admin\FeedbackController::class, 'destroy']);
    Route::post('/feedbacks/{id}/archive', [\App\Http\Controllers\Admin\FeedbackController::class, 'archive']);
    Route::post('/feedbacks/bulk-delete', [\App\Http\Controllers\Admin\FeedbackController::class, 'bulkDelete']);
    // Replies to feedback (admin)
    Route::get('/feedbacks/{id}/replies', [\App\Http\Controllers\Admin\FeedbackReplyController::class, 'index']);
    Route::post('/feedbacks/{id}/replies', [\App\Http\Controllers\Admin\FeedbackReplyController::class, 'store']);
    Route::delete('/feedbacks/replies/{id}', [\App\Http\Controllers\Admin\FeedbackReplyController::class, 'destroy']);

    /*
    |--------------------------------------------------------------------------
    | CUSTOM FIELD MODULE SYSTEM ROUTES
    |--------------------------------------------------------------------------
    */
    Route::prefix('custom-modules')->group(function () {
        // Module CRUD
        Route::get('/', [\App\Http\Controllers\Admin\CustomModuleController::class, 'index']);
        Route::post('/', [\App\Http\Controllers\Admin\CustomModuleController::class, 'store']);
        Route::get('/categories', [\App\Http\Controllers\Admin\CustomModuleController::class, 'categories']);
        Route::get('/tags', [\App\Http\Controllers\Admin\CustomModuleController::class, 'tags']);
        Route::get('/ui-components', [\App\Http\Controllers\Admin\CustomModuleController::class, 'uiComponents']);
        Route::post('/reorder', [\App\Http\Controllers\Admin\CustomModuleController::class, 'reorder']);
        Route::get('/{id}', [\App\Http\Controllers\Admin\CustomModuleController::class, 'show']);
        Route::put('/{id}', [\App\Http\Controllers\Admin\CustomModuleController::class, 'update']);
        Route::delete('/{id}', [\App\Http\Controllers\Admin\CustomModuleController::class, 'destroy']);
        Route::post('/{id}/toggle-publish', [\App\Http\Controllers\Admin\CustomModuleController::class, 'togglePublish']);
        Route::post('/{id}/thumbnail', [\App\Http\Controllers\Admin\CustomModuleController::class, 'uploadThumbnail']);
        Route::delete('/{id}/thumbnail', [\App\Http\Controllers\Admin\CustomModuleController::class, 'removeThumbnail']);
        Route::get('/{id}/versions', [\App\Http\Controllers\Admin\CustomModuleController::class, 'versions']);
        Route::get('/{id}/available-courses', [\App\Http\Controllers\Admin\CustomModuleController::class, 'availableCourses']);
        Route::post('/{id}/push-to-course', [\App\Http\Controllers\Admin\CustomModuleController::class, 'pushToCourse']);
        Route::post('/{id}/push-to-courses', [\App\Http\Controllers\Admin\CustomModuleController::class, 'pushToCourses']);
        // Push to users (Instructors & Employees)
        Route::get('/{id}/available-users', [\App\Http\Controllers\Admin\CustomModuleController::class, 'availableUsers']);
        Route::post('/{id}/push-to-users', [\App\Http\Controllers\Admin\CustomModuleController::class, 'pushToUsers']);

        // Lesson management within a module
        Route::get('/{moduleId}/lessons', [\App\Http\Controllers\Admin\CustomLessonController::class, 'index']);
        Route::post('/{moduleId}/lessons', [\App\Http\Controllers\Admin\CustomLessonController::class, 'store']);
        Route::post('/{moduleId}/lessons/reorder', [\App\Http\Controllers\Admin\CustomLessonController::class, 'reorder']);
        Route::get('/{moduleId}/lessons/{lessonId}', [\App\Http\Controllers\Admin\CustomLessonController::class, 'show']);
        Route::put('/{moduleId}/lessons/{lessonId}', [\App\Http\Controllers\Admin\CustomLessonController::class, 'update']);
        Route::delete('/{moduleId}/lessons/{lessonId}', [\App\Http\Controllers\Admin\CustomLessonController::class, 'destroy']);
        Route::get('/{moduleId}/lessons/{lessonId}/content', [\App\Http\Controllers\Admin\CustomLessonController::class, 'content']);
    });
});

// Public (authenticated) endpoint to record lesson events (play/pause/progress)
Route::post('/lesson-events', [AnalyticsController::class, 'recordLessonEvent'])->middleware(['auth:sanctum', 'status']);

// Admin: get recent lesson events (optionally filter by lesson or user)
Route::get('/admin/lesson-events', [AnalyticsController::class, 'recentLessonEvents'])->middleware(['auth:sanctum', 'status', 'role:Admin']);

if (env('APP_ENV') === 'local') {
    Route::get('/dev/create-it-test', function () {
        $u = \App\Models\User::firstOrCreate([
            'email' => 'it-test@example.com',
        ], [
            'fullname' => 'IT Tester',
            'password' => bcrypt('password'),
            'role' => 'employee',
            'department' => 'IT',
            'status' => 'Active',
        ]);

        $s = \App\Models\User::firstOrCreate([
            'email' => 'student-test@example.com',
        ], [
            'fullname' => 'Student Tester',
            'password' => bcrypt('password'),
            'role' => 'employee',
            'department' => 'IT',
            'status' => 'Active',
        ]);

        $course = \App\Models\Course::firstOrCreate([
            'title' => 'IT Test Course',
        ], [
            'description' => 'Test course',
            'department' => 'IT',
            'status' => 'Active',
        ]);

        if (! \App\Models\Enrollment::where('course_id', $course->id)->where('user_id', $s->id)->exists()) {
            $course->enrollments()->create([
                'user_id' => $s->id,
                'progress' => 0,
                'enrolled_at' => now(),
                'status' => 'Not Started',
            ]);
        }

        $token = $u->createToken('it-test-token')->plainTextToken;

        return response()->json([
            'token' => $token,
            'course_id' => $course->id,
            'student_id' => $s->id,
            'actor_id' => $u->id,
        ]);
    });

    // Create a dev admin and two test users, return admin token and test user IDs
    Route::post('/dev/create-admin-and-test-users', function () {
        $admin = \App\Models\User::firstOrCreate([
            'email' => 'dev-admin@example.com',
        ], [
            'fullname' => 'Dev Admin',
            'password' => bcrypt('password'),
            'role' => 'admin',
            'department' => 'IT',
            'status' => 'Active',
        ]);

        $u1 = \App\Models\User::firstOrCreate([
            'email' => 'dev-user1@example.com',
        ], [
            'fullname' => 'Dev User 1',
            'password' => bcrypt('password'),
            'role' => 'employee',
            'department' => 'IT',
            'status' => 'Active',
        ]);

        $u2 = \App\Models\User::firstOrCreate([
            'email' => 'dev-user2@example.com',
        ], [
            'fullname' => 'Dev User 2',
            'password' => bcrypt('password'),
            'role' => 'employee',
            'department' => 'IT',
            'status' => 'Active',
        ]);

        $token = $admin->createToken('dev-admin-token')->plainTextToken;

        return response()->json([
            'token' => $token,
            'test_user_ids' => [$u1->id, $u2->id],
        ]);
    });
}

/*
|--------------------------------------------------------------------------
| INSTRUCTOR ROUTES - Role: Instructor Only
|--------------------------------------------------------------------------
*/

use App\Http\Controllers\Instructor\CourseController as InstructorCourseController;
use App\Http\Controllers\Instructor\QuizController as InstructorQuizController;

Route::prefix('instructor')->middleware(['auth:sanctum', 'status', 'role:Instructor'])->group(function () {

    // Dashboard
    Route::get('/dashboard', [InstructorCourseController::class, 'dashboard']);

    // Course CRUD
    Route::get('/courses', [InstructorCourseController::class, 'index']);
    Route::post('/courses', [InstructorCourseController::class, 'store']);
    Route::get('/courses/{id}', [InstructorCourseController::class, 'show']);
    Route::put('/courses/{id}', [InstructorCourseController::class, 'update']);
    Route::delete('/courses/{id}', [InstructorCourseController::class, 'destroy']);

    // Module Management
    Route::post('/courses/{id}/modules', [InstructorCourseController::class, 'addModule']);
    Route::put('/courses/{courseId}/modules/{moduleId}', [InstructorCourseController::class, 'updateModule']);
    Route::delete('/courses/{courseId}/modules/{moduleId}', [InstructorCourseController::class, 'deleteModule']);
    Route::post('/courses/{courseId}/modules/reorder', [InstructorCourseController::class, 'reorderModules']);

    // Enrollment Management
    Route::get('/courses/{id}/enrollments', [InstructorCourseController::class, 'enrollments']);
    Route::post('/courses/{id}/enrollments', [InstructorCourseController::class, 'enroll']);
    Route::delete('/courses/{courseId}/enrollments/{userId}', [InstructorCourseController::class, 'unenroll']);
    Route::post('/courses/{courseId}/enrollments/{userId}/lock', [InstructorCourseController::class, 'lockEnrollment']);
    Route::post('/courses/{courseId}/enrollments/{userId}/unlock', [InstructorCourseController::class, 'unlockEnrollment']);

    // Per-module lock/unlock for a specific user
    Route::post('/courses/{courseId}/modules/{moduleId}/enrollments/{userId}/lock', [InstructorCourseController::class, 'lockModule']);
    Route::post('/courses/{courseId}/modules/{moduleId}/enrollments/{userId}/unlock', [InstructorCourseController::class, 'unlockModule']);
    // Bulk per-module lock/unlock for a given department
    Route::post('/courses/{courseId}/modules/{moduleId}/unlock-department', [InstructorCourseController::class, 'unlockModuleForDepartment']);
    Route::post('/courses/{courseId}/modules/{moduleId}/lock-department', [InstructorCourseController::class, 'lockModuleForDepartment']);
    // Bulk: unlock all modules in a course for a given department
    Route::post('/courses/{courseId}/unlock-department-all', [InstructorCourseController::class, 'unlockAllModulesForDepartment']);

    // Users list (for enrollment dropdown)
    Route::get('/users', [InstructorCourseController::class, 'listUsers']);

    // Lesson Management
    Route::post('/modules/{moduleId}/lessons', [InstructorCourseController::class, 'addLesson']);
    Route::post('/modules/{moduleId}/lessons/{lessonId}', [InstructorCourseController::class, 'updateLesson']);
    Route::delete('/modules/{moduleId}/lessons/{lessonId}', [InstructorCourseController::class, 'deleteLesson']);

    // Quiz Management
    Route::get('/quizzes', [InstructorQuizController::class, 'index']);
    Route::get('/quiz-attempts', [InstructorQuizController::class, 'attempts']);
    Route::get('/courses/{courseId}/quizzes', [InstructorQuizController::class, 'forCourse']);
    Route::post('/courses/{courseId}/quizzes', [InstructorQuizController::class, 'store']);
    Route::get('/modules/{moduleId}/quizzes', [InstructorQuizController::class, 'forModule']);
    Route::post('/modules/{moduleId}/quizzes', [InstructorQuizController::class, 'storeForModule']);
    Route::get('/quizzes/{id}', [InstructorQuizController::class, 'show']);
    Route::put('/quizzes/{id}', [InstructorQuizController::class, 'update']);
    Route::delete('/quizzes/{id}', [InstructorQuizController::class, 'destroy']);
    Route::post('/quizzes/{quizId}/questions', [InstructorQuizController::class, 'addQuestion']);
    Route::put('/quizzes/{quizId}/questions/{questionId}', [InstructorQuizController::class, 'updateQuestion']);
    Route::delete('/quizzes/{quizId}/questions/{questionId}', [InstructorQuizController::class, 'deleteQuestion']);

    // Q&A (Instructor)
    Route::get('/lessons', [\App\Http\Controllers\QAController::class, 'instructorLessons']);
    Route::get('/questions', [\App\Http\Controllers\QAController::class, 'instructorIndex']);
    Route::post('/questions/{id}/replies', [\App\Http\Controllers\QAController::class, 'storeReply']);
    Route::delete('/questions/{questionId}/replies/{replyId}', [\App\Http\Controllers\QAController::class, 'destroyReply']);
    Route::post('/questions/{questionId}/replies/{replyId}/reactions', [\App\Http\Controllers\QAController::class, 'toggleReaction']);

    // YouTube Video Management (Instructor)
    Route::prefix('youtube')->group(function () {
        Route::get('/auth-check', [\App\Http\Controllers\YouTubeController::class, 'checkAuth']);
        Route::get('/videos', [\App\Http\Controllers\YouTubeController::class, 'listVideos']);
        Route::get('/videos/{videoId}', [\App\Http\Controllers\YouTubeController::class, 'getVideo']);
        Route::put('/videos/{videoId}', [\App\Http\Controllers\YouTubeController::class, 'updateVideo']);
        Route::post('/videos/tags', [\App\Http\Controllers\YouTubeController::class, 'updateVideoTags']);
        Route::post('/videos/upload', [\App\Http\Controllers\YouTubeController::class, 'uploadVideo']);
        Route::delete('/videos/{videoId}', [\App\Http\Controllers\YouTubeController::class, 'deleteVideo']);
    });

    // Notification Management (Instructor)
    Route::prefix('notifications')->group(function () {
        Route::get('/', [\App\Http\Controllers\NotificationController::class, 'index']);
        Route::get('/unread-count', [\App\Http\Controllers\NotificationController::class, 'unreadCount']);
        Route::get('/sent-history', [\App\Http\Controllers\NotificationController::class, 'getSentAnnouncements']);
        Route::get('/recently-deleted', [\App\Http\Controllers\NotificationController::class, 'getRecentlyDeletedNotifications']);
        Route::post('/{id}/read', [\App\Http\Controllers\NotificationController::class, 'markAsRead']);
        Route::post('/read-all', [\App\Http\Controllers\NotificationController::class, 'markAllAsRead']);
        Route::delete('/{id}', [\App\Http\Controllers\NotificationController::class, 'destroy']);
        Route::post('/{id}/restore', [\App\Http\Controllers\NotificationController::class, 'restoreNotification']);
        Route::delete('/{id}/permanent', [\App\Http\Controllers\NotificationController::class, 'permanentlyDeleteNotification']);
        Route::post('/notify-employees', [\App\Http\Controllers\NotificationController::class, 'instructorNotify']);
        Route::post('/notify-admin', [\App\Http\Controllers\NotificationController::class, 'instructorNotifyAdmin']);
    });
    // Instructor access to feedback listing (only courses this instructor teaches)
    Route::get('/feedbacks', function (Request $request) {
        $instructorId = $request->user()->id;
        $type = $request->get('type', 'lesson');
        $archived = filter_var($request->query('archived'), FILTER_VALIDATE_BOOLEAN);

        if ($type === 'quiz') {
            $query = \App\Models\QuizFeedback::with([
                'user:id,fullname,department,role',
                'quiz.module.course:id,title,department,instructor_id',
            ])
            ->whereHas('quiz.module.course', function ($q) use ($instructorId) {
                $q->where('instructor_id', $instructorId);
            })
            ->orderByDesc('created_at');

            if ($archived) {
                $query->whereNotNull('archived_at');
            } else {
                $query->whereNull('archived_at');
            }

            $perPage = max(10, min(200, (int) $request->get('per_page', 50)));
            $page = $query->paginate($perPage);

            return response()->json($page->through(function ($fb) {
                return [
                    'type' => 'quiz',
                    'id' => $fb->id,
                    'user' => [
                        'id' => $fb->user?->id,
                        'name' => $fb->user?->fullname,
                        'department' => $fb->user?->department,
                    ],
                    'lesson' => [
                        'id' => $fb->quiz?->id,
                        'title' => $fb->quiz?->title,
                        'module' => $fb->quiz?->module?->title ?? null,
                        'course' => $fb->quiz?->module?->course?->title ?? null,
                        'course_department' => $fb->quiz?->module?->course?->department ?? null,
                    ],
                    'rating' => $fb->rating,
                    'comment' => $fb->comment,
                    'created_at' => $fb->created_at?->toISOString(),
                    'archived' => (bool) $fb->archived_at,
                ];
            }));
        }

        $query = \App\Models\LessonFeedback::with([
            'user:id,fullname,department,role',
            'lesson.module.course:id,title,department,instructor_id',
        ])
        ->whereHas('lesson.module.course', function ($q) use ($instructorId) {
            $q->where('instructor_id', $instructorId);
        })
        ->orderByDesc('created_at');

        if ($archived) {
            $query->whereNotNull('archived_at');
        } else {
            $query->whereNull('archived_at');
        }

        if ($request->has('course_id')) {
            $query->whereHas('lesson.module', function ($q) use ($request) {
                $q->where('course_id', $request->course_id);
            });
        }

        if ($request->has('lesson_id')) {
            $query->where('lesson_id', $request->lesson_id);
        }

        $perPage = max(10, min(200, (int) $request->get('per_page', 50)));
        $page = $query->paginate($perPage);

        return response()->json($page->through(function ($fb) {
            return [
                'type' => 'lesson',
                'id' => $fb->id,
                'user' => [
                    'id' => $fb->user?->id,
                    'name' => $fb->user?->fullname,
                    'department' => $fb->user?->department,
                ],
                'lesson' => [
                    'id' => $fb->lesson?->id,
                    'title' => $fb->lesson?->title,
                    'module' => $fb->lesson?->module?->title ?? null,
                    'course' => $fb->lesson?->module?->course?->title ?? null,
                    'course_department' => $fb->lesson?->module?->course?->department ?? null,
                ],
                'rating' => $fb->rating,
                'comment' => $fb->comment,
                'created_at' => $fb->created_at?->toISOString(),
                'archived' => (bool) $fb->archived_at,
            ];
        }));
    });

    // Custom Modules (read-only access for instructors)
    Route::get('/custom-modules', function (Request $request) {
        // Instructors can only view published learning modules (not UI components)
        return \App\Models\CustomModule::with(['creator:id,fullname,email', 'lessons'])
            ->where('status', 'published')
            ->where('module_type', 'learning') // Only learning modules for instructors
            ->orderBy('order')
            ->get();
    });
    Route::get('/custom-modules/{id}', function (Request $request, int $id) {
        // Instructors can only view published learning modules (not UI components)
        return \App\Models\CustomModule::with(['creator:id,fullname,email', 'lessons'])
            ->where('status', 'published')
            ->where('module_type', 'learning') // Only learning modules for instructors
            ->findOrFail($id);
    });

    // Custom Module lesson editing (instructors can edit lesson title/description/content)
    Route::put('/custom-modules/{moduleId}/lessons/{lessonId}', [\App\Http\Controllers\Admin\CustomLessonController::class, 'update']);

    // Custom Module assignment to department
    Route::post('/custom-modules/{id}/push-to-department', [\App\Http\Controllers\Instructor\CustomModuleController::class, 'pushToDepartment']);
    Route::get('/custom-modules/{id}/department-employees', [\App\Http\Controllers\Instructor\CustomModuleController::class, 'getDepartmentEmployees']);
});


/*
|--------------------------------------------------------------------------
| EMPLOYEE ROUTES - Role: Employee Only + Department Access
|--------------------------------------------------------------------------
*/

use App\Http\Controllers\Employee\CertificateController;
use App\Http\Controllers\Employee\DashboardController;
use App\Http\Controllers\Employee\QuizController as EmployeeQuizController;

Route::prefix('employee')->middleware(['auth:sanctum', 'status', 'role:Employee', 'department'])->group(function () {

    // Dashboard (auto-filtered by department)
    Route::get('/dashboard', [DashboardController::class, 'index']);

    // All active courses in employee's department (with enrollment status)
    Route::get('/all-courses', [DashboardController::class, 'allCourses']);

    // Only enrolled courses (My Courses)
    Route::get('/courses', [DashboardController::class, 'courses']);
    Route::get('/courses/{id}', [DashboardController::class, 'showCourse']);

    // Self-enroll
    Route::post('/courses/{id}/enroll', [DashboardController::class, 'enroll']);

    // My Progress
    Route::get('/progress', [DashboardController::class, 'progress']);

    // Certificates
    Route::get('/certificates', [CertificateController::class, 'index']);
    Route::post('/certificates/{id}/logo', [CertificateController::class, 'uploadLogo']);
    Route::delete('/certificates/{id}/logo', [CertificateController::class, 'removeLogo']);

    // Lesson Feedback
    Route::get('/feedbacks', [\App\Http\Controllers\Employee\FeedbackController::class, 'index']);
    Route::get('/quiz-feedbacks', [\App\Http\Controllers\Employee\FeedbackController::class, 'quizIndex']);
    Route::post('/feedbacks', [\App\Http\Controllers\Employee\FeedbackController::class, 'store']);
    Route::put('/feedbacks/{id}', [\App\Http\Controllers\Employee\FeedbackController::class, 'update']);
    Route::delete('/feedbacks/{id}', [\App\Http\Controllers\Employee\FeedbackController::class, 'destroy']);
    Route::get('/enrolled-lessons', [\App\Http\Controllers\Employee\FeedbackController::class, 'enrolledLessons']);
    Route::get('/enrolled-quizzes', [\App\Http\Controllers\Employee\FeedbackController::class, 'enrolledQuizzes']);
    // Quiz feedback
    Route::post('/quiz-feedbacks', [\App\Http\Controllers\Employee\FeedbackController::class, 'storeQuiz']);
    Route::put('/quiz-feedbacks/{id}', [\App\Http\Controllers\Employee\FeedbackController::class, 'updateQuiz']);
    Route::delete('/quiz-feedbacks/{id}', [\App\Http\Controllers\Employee\FeedbackController::class, 'destroyQuiz']);

    // Quiz taking
    Route::get('/quizzes/{quizId}', [EmployeeQuizController::class, 'show']);
    Route::post('/quizzes/{quizId}/submit', [EmployeeQuizController::class, 'submit']);
    Route::get('/quizzes/{quizId}/attempts', [EmployeeQuizController::class, 'myAttempts']);

    // Quiz reminders (upcoming deadlines)
    Route::get('/quiz-reminders', [DashboardController::class, 'quizReminders']);

    // Q&A (Employee)
    Route::get('/lessons', [\App\Http\Controllers\QAController::class, 'employeeLessons']);
    Route::get('/questions', [\App\Http\Controllers\QAController::class, 'employeeIndex']);
    Route::post('/questions', [\App\Http\Controllers\QAController::class, 'employeeStore']);
    Route::put('/questions/{id}', [\App\Http\Controllers\QAController::class, 'employeeUpdate']);
    Route::delete('/questions/{id}', [\App\Http\Controllers\QAController::class, 'employeeDestroy']);
    Route::post('/questions/{id}/replies', [\App\Http\Controllers\QAController::class, 'storeReply']);
    Route::delete('/questions/{questionId}/replies/{replyId}', [\App\Http\Controllers\QAController::class, 'destroyReply']);
    Route::post('/questions/{questionId}/replies/{replyId}/reactions', [\App\Http\Controllers\QAController::class, 'toggleReaction']);

    // Notification Management (Employee)
    Route::prefix('notifications')->group(function () {
        Route::get('/', [\App\Http\Controllers\NotificationController::class, 'index']);
        Route::get('/unread-count', [\App\Http\Controllers\NotificationController::class, 'unreadCount']);
        Route::get('/recently-deleted', [\App\Http\Controllers\NotificationController::class, 'getRecentlyDeletedNotifications']);
        Route::get('/instructors', [\App\Http\Controllers\NotificationController::class, 'getInstructorsForEmployee']);
        Route::post('/read-all', [\App\Http\Controllers\NotificationController::class, 'markAllAsRead']);
        Route::post('/notify-instructor', [\App\Http\Controllers\NotificationController::class, 'employeeNotifyInstructor']);
        Route::post('/report-admin', [\App\Http\Controllers\NotificationController::class, 'employeeReportToAdmin']);
        Route::post('/{id}/read', [\App\Http\Controllers\NotificationController::class, 'markAsRead']);
        Route::delete('/{id}', [\App\Http\Controllers\NotificationController::class, 'destroy']);
        Route::post('/{id}/restore', [\App\Http\Controllers\NotificationController::class, 'restoreNotification']);
        Route::delete('/{id}/permanent', [\App\Http\Controllers\NotificationController::class, 'permanentlyDeleteNotification']);
    });

    // Custom Modules (assigned to employee)
    Route::get('/custom-modules', [\App\Http\Controllers\Employee\CustomModuleController::class, 'assignedModules']);
    Route::get('/custom-modules/{id}', [\App\Http\Controllers\Employee\CustomModuleController::class, 'show']);
});

// Q&A routes are now defined inside each role's route group above
// (employee/questions, admin/questions, instructor/questions)

// Chatbot endpoint removed — use persistent Q&A endpoints instead.

/*
|--------------------------------------------------------------------------
| MODULE CONTENT ROUTES - Authenticated Users Only
|--------------------------------------------------------------------------
*/

use App\Http\Controllers\ContentController;

// ── File Conversion Routes (public for course viewing) ──
Route::prefix('convert')->group(function () {
    Route::get('/availability', [\App\Http\Controllers\FileConversionController::class, 'checkAvailability']);
    Route::post('/pdf-to-pptx', [\App\Http\Controllers\FileConversionController::class, 'convertPdfToPptx']);
    Route::post('/pptx-to-pdf', [\App\Http\Controllers\FileConversionController::class, 'convertPptxToPdf']);
    Route::post('/pptx-as-pdf', [\App\Http\Controllers\FileConversionController::class, 'getPptxAsPdf']);
});

// Serve module content for authenticated users
Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/modules/{module}/content', function (\App\Models\Module $module) {
        $path = storage_path('app/public/'.$module->content_path);

        if (! file_exists($path)) {
            return response()->json(['message' => 'File not found'], 404);
        }

        return response()->file($path);
    });

    // ── Module CRUD ──
    Route::get('/courses/{courseId}/modules', [ContentController::class, 'modulesByCourse']);
    Route::post('/courses/{courseId}/modules', [ContentController::class, 'storeModule']);
    Route::put('/modules/{moduleId}', [ContentController::class, 'updateModule']);
    Route::delete('/modules/{moduleId}', [ContentController::class, 'destroyModule']);

    // ── Lesson / Content CRUD ──
    Route::post('/modules/{moduleId}/lessons', [ContentController::class, 'storeLesson']);
    Route::post('/lessons/{lessonId}', [ContentController::class, 'updateLesson']);
    Route::delete('/lessons/{lessonId}', [ContentController::class, 'destroyLesson']);

    // ── Profile Settings ──
    Route::get('/profile', function (Request $request) {
        $user = $request->user();

        return response()->json([
            'id' => $user->id,
            // Prefer camelCase DB column `fullName` but fall back to `fullname` if present
            'fullName' => $user->fullName ?? $user->fullname,
            'email' => $user->email,
            'role' => $user->role,
            'company_role' => $user->company_role,
            'personal_gmail' => $user->personal_gmail,
            'department' => $user->department,
            'status' => $user->status,
            'profile_picture' => $user->profile_picture ? asset('storage/'.$user->profile_picture) : null,
            'signature_path' => $user->signature_path ? asset('storage/'.$user->signature_path) : null,
        ]);
    });

    Route::post('/profile', function (Request $request) {
        $user = $request->user();

        $rules = [
            'fullName' => 'sometimes|string|max:255',
        ];

        // Only admins can change email and password
        if ($user->isAdmin()) {
            $rules['email'] = 'sometimes|email|max:255|unique:users,email,'.$user->id;
            $rules['password'] = 'sometimes|string|min:8|confirmed';
            $rules['company_role'] = 'sometimes|nullable|string|max:255';
            $rules['personal_gmail'] = 'sometimes|nullable|email|max:255';
        }

        $validated = $request->validate($rules);

        // Map camelCase `fullName` coming from the frontend into the
        // actual lowercase `fullname` column used by this database.
        if (isset($validated['fullName'])) {
            $validated['fullname'] = $validated['fullName'];
            unset($validated['fullName']);
        }

        // Strip email and password if a non-admin somehow submitted them
        if (! $user->isAdmin()) {
            unset($validated['email']);
            unset($validated['password']);
        }

        if (isset($validated['password'])) {
            $validated['password'] = bcrypt($validated['password']);
        }

        $user->update($validated);
        $user->refresh();

        // Record an audit log for profile updates (non-fatal if DB/table missing)
        try {
            $ts = Carbon::now()->utc();
            $log = AuditLog::create([
                'user_id' => $user->id,
                'action' => 'profile_updated',
                'ip_address' => $request->ip(),
                'created_at' => $ts,
            ]);
            event(new \App\Events\AuditLogCreated($log));
        } catch (\Exception $e) {
            // Log and continue — do not break the profile update flow
            Log::warning('Failed to create AuditLog for profile update', ['error' => $e->getMessage()]);
        }

        return response()->json([
            'message' => 'Profile updated successfully.',
            'user' => [
                'id' => $user->id,
                // Prefer camelCase DB column `fullName` but fall back to `fullname` if present
                'fullName' => $user->fullName ?? $user->fullname,
                'email' => $user->email,
                'role' => $user->role,
                'company_role' => $user->company_role,
                'personal_gmail' => $user->personal_gmail,
                'department' => $user->department,
                'profile_picture' => $user->profile_picture ? asset('storage/'.$user->profile_picture) : null,
                'signature_path' => $user->signature_path ? asset('storage/'.$user->signature_path) : null,
            ],
        ]);
    });

    Route::post('/profile/picture', function (Request $request) {
        $request->validate([
            'profile_picture' => 'required|image|mimes:jpeg,png,jpg,gif|max:2048',
        ]);

        $user = $request->user();

        // Delete old picture if exists
        if ($user->profile_picture && \Illuminate\Support\Facades\Storage::disk('public')->exists($user->profile_picture)) {
            \Illuminate\Support\Facades\Storage::disk('public')->delete($user->profile_picture);
        }

        $path = $request->file('profile_picture')->store('profile-pictures', 'public');
        $user->update(['profile_picture' => $path]);

        return response()->json([
            'message' => 'Profile picture updated successfully.',
            'profile_picture' => asset('storage/'.$path),
        ]);
    });

    Route::delete('/profile/picture', function (Request $request) {
        $user = $request->user();
        if ($user->profile_picture && \Illuminate\Support\Facades\Storage::disk('public')->exists($user->profile_picture)) {
            \Illuminate\Support\Facades\Storage::disk('public')->delete($user->profile_picture);
        }
        $user->update(['profile_picture' => null]);
        return response()->json(['message' => 'Profile picture removed.']);
    });

    Route::post('/profile/signature', function (Request $request) {
        $user = $request->user();
        if (!$user || !($user->isInstructor() || $user->isAdmin())) {
            return response()->json(['message' => 'Only admins and instructors can upload a certificate signature.'], 403);
        }

        $request->validate([
            // Optional dimension cap keeps signatures usable on certificate layout.
            'signature' => 'required|image|mimes:png|max:2048|dimensions:max_width=3000,max_height=1200',
        ]);

        $file = $request->file('signature');
        $realPath = $file?->getRealPath();
        if (!is_string($realPath) || !is_file($realPath)) {
            return response()->json(['message' => 'Invalid signature upload. Please try again.'], 422);
        }

        $signatureInfo = @getimagesize($realPath);
        if (!$signatureInfo || (int) ($signatureInfo[2] ?? 0) !== IMAGETYPE_PNG) {
            return response()->json(['message' => 'Signature must be a PNG image.'], 422);
        }

        $isSignatureLike = function (string $path): bool {
            if (!extension_loaded('gd')) {
                \Illuminate\Support\Facades\Log::warning('Signature validation skipped: GD extension not available.');
                return true;
            }

            $info = @getimagesize($path);
            if (!$info || empty($info[0]) || empty($info[1])) {
                return false;
            }

            $width = (int) $info[0];
            $height = (int) $info[1];
            $ratio = $width > 0 ? ($width / max(1, $height)) : 0;
            if ($ratio < 1.6) {
                return false;
            }

            $type = (int) ($info[2] ?? 0);
            $img = null;
            if ($type === IMAGETYPE_PNG) {
                $img = @imagecreatefrompng($path);
            }

            if (!$img) {
                return false;
            }

            $step = (int) max(1, floor(max($width, $height) / 220));
            $total = 0;
            $ink = 0;
            $nearWhite = 0;
            $transparent = 0;
            $minX = $width;
            $minY = $height;
            $maxX = 0;
            $maxY = 0;

            for ($y = 0; $y < $height; $y += $step) {
                for ($x = 0; $x < $width; $x += $step) {
                    $rgba = imagecolorat($img, $x, $y);
                    $alpha = ($rgba & 0x7F000000) >> 24;
                    $r = ($rgba >> 16) & 0xFF;
                    $g = ($rgba >> 8) & 0xFF;
                    $b = $rgba & 0xFF;
                    $lum = (0.2126 * $r) + (0.7152 * $g) + (0.0722 * $b);

                    $total++;

                    if ($alpha >= 100) {
                        $transparent++;
                        continue;
                    }

                    if ($lum >= 230) {
                        $nearWhite++;
                        continue;
                    }

                    if ($lum <= 90) {
                        $ink++;
                        if ($x < $minX) $minX = $x;
                        if ($y < $minY) $minY = $y;
                        if ($x > $maxX) $maxX = $x;
                        if ($y > $maxY) $maxY = $y;
                    }
                }
            }

            imagedestroy($img);

            if ($total === 0) {
                return false;
            }

            $inkRatio = $ink / $total;
            $whiteRatio = $nearWhite / $total;
            $transparentRatio = $transparent / $total;

            if ($inkRatio < 0.002 || $inkRatio > 0.18) {
                return false;
            }

            if ($transparentRatio < 0.2 && $whiteRatio < 0.7) {
                return false;
            }

            if ($maxX <= $minX || $maxY <= $minY) {
                return false;
            }

            $inkWidthRatio = (($maxX - $minX) + 1) / max(1, $width);
            $inkHeightRatio = (($maxY - $minY) + 1) / max(1, $height);

            if ($inkWidthRatio < 0.2 || $inkHeightRatio > 0.65) {
                return false;
            }

            return true;
        };

        if (!$isSignatureLike($realPath)) {
            return response()->json([
                'message' => 'Signature image must look like a real signature (transparent or white background with minimal ink).'
            ], 422);
        }

        // Replace any previous signature file.
        if ($user->signature_path && \Illuminate\Support\Facades\Storage::disk('public')->exists($user->signature_path)) {
            \Illuminate\Support\Facades\Storage::disk('public')->delete($user->signature_path);
        }

        $filename = (string) \Illuminate\Support\Str::uuid().'.png';
        $path = $file->storeAs('signatures', $filename, 'public');

        $user->update(['signature_path' => $path]);

        return response()->json([
            'message' => 'Signature uploaded successfully.',
            'signature_path' => asset('storage/'.$path),
        ]);
    });

    // Time Log: Punch in / Punch out / My logs
    Route::prefix('time-logs')->group(function () {
        Route::post('/punch-in', [\App\Http\Controllers\TimeLogController::class, 'punchIn'])->middleware(['auth:sanctum', 'status']);
        Route::post('/punch-out', [\App\Http\Controllers\TimeLogController::class, 'punchOut'])->middleware(['auth:sanctum', 'status']);
        Route::get('/me', [\App\Http\Controllers\TimeLogController::class, 'myLogs'])->middleware(['auth:sanctum', 'status']);
        // Admin/Instructor: Get logs for any user
        Route::get('/{userId}', [\App\Http\Controllers\TimeLogController::class, 'userLogs'])->middleware(['auth:sanctum', 'status']);
        // Admin actions for individual logs (update / archive / delete)
        Route::put('/admin/{logId}', [\App\Http\Controllers\TimeLogController::class, 'updateLog'])->middleware(['auth:sanctum', 'status']);
        Route::post('/admin/{logId}/archive', [\App\Http\Controllers\TimeLogController::class, 'archive'])->middleware(['auth:sanctum', 'status']);
        Route::delete('/admin/{logId}', [\App\Http\Controllers\TimeLogController::class, 'deleteLog'])->middleware(['auth:sanctum', 'status']);
        // Admin: bulk delete time logs for multiple users
        Route::post('/admin/bulk-delete', [\App\Http\Controllers\TimeLogController::class, 'bulkDelete'])->middleware(['auth:sanctum', 'status']);
    });

    // ── Lesson/Module Specific Conversion Routes (require auth) ──
    Route::prefix('convert')->group(function () {
        Route::post('/lessons/{lessonId}/pdf-to-pptx', [\App\Http\Controllers\FileConversionController::class, 'convertLessonPdfToPptx']);
        Route::post('/modules/{moduleId}/pdf-to-pptx', [\App\Http\Controllers\FileConversionController::class, 'convertModulePdfToPptx']);
    });
});
