<?php

use App\Models\AuditLog;
use App\Models\Department;
use App\Models\Subdepartment;
use App\Models\TimeLog;
use App\Models\User;
use App\Support\AuditDate;
use App\Http\Controllers\LoginController;
use App\Http\Controllers\PasswordResetController;
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
    Route::post('/users/{id}/photo', [UserController::class, 'uploadPhoto']);
    Route::get('/users/{id}/recovery-key', [UserController::class, 'getRecoveryKey']);
    Route::post('/users/{id}/regenerate-recovery-key', [UserController::class, 'regenerateRecoveryKey']);
    // Bulk delete users (accepts JSON { ids: [1,2,3] })
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
    // Bulk delete audit logs by id
    Route::post('/audit-logs/bulk-delete', function (Request $request) {
        $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer|exists:audit_logs,id',
        ]);
        $ids = $request->input('ids', []);
        $deleted = \App\Models\AuditLog::whereIn('id', $ids)->delete();

        // Auto-cleanup: if recently deleted count >= 50, permanently delete oldest half
        $trashedCount = \App\Models\AuditLog::onlyTrashed()->count();
        $permanentlyDeleted = 0;
        if ($trashedCount >= 50) {
            $halfCount = (int) floor($trashedCount / 2);
            $oldestIds = \App\Models\AuditLog::onlyTrashed()
                ->orderBy('deleted_at', 'asc')
                ->limit($halfCount)
                ->pluck('id');
            $permanentlyDeleted = \App\Models\AuditLog::onlyTrashed()
                ->whereIn('id', $oldestIds)
                ->forceDelete();
        }

        return response()->json(['deleted' => $deleted, 'permanently_deleted' => $permanentlyDeleted]);
    });

    // Bulk delete audit logs by user ids (delete all logs for selected users)
    Route::post('/audit-logs/bulk-delete-by-users', function (Request $request) {
        $request->validate([
            'user_ids' => 'required|array|min:1',
            'user_ids.*' => 'integer|exists:users,id',
        ]);
        $userIds = $request->input('user_ids', []);
        $deleted = \App\Models\AuditLog::whereIn('user_id', $userIds)->delete();

        // Auto-cleanup: if recently deleted count >= 50, permanently delete oldest half
        $trashedCount = \App\Models\AuditLog::onlyTrashed()->count();
        $permanentlyDeleted = 0;
        if ($trashedCount >= 50) {
            $halfCount = (int) floor($trashedCount / 2);
            $oldestIds = \App\Models\AuditLog::onlyTrashed()
                ->orderBy('deleted_at', 'asc')
                ->limit($halfCount)
                ->pluck('id');
            $permanentlyDeleted = \App\Models\AuditLog::onlyTrashed()
                ->whereIn('id', $oldestIds)
                ->forceDelete();
        }

        return response()->json(['deleted' => $deleted, 'permanently_deleted' => $permanentlyDeleted]);
    });

    // Get recently deleted audit logs
    Route::get('/audit-logs/recently-deleted', function (Request $request) {
        $deleted = \App\Models\AuditLog::onlyTrashed()
            ->with('user:id,fullname,email,role,department')
            ->orderByDesc('deleted_at')
            ->limit(100)
            ->get()
            ->map(function ($log) {
                return [
                    'id' => $log->id,
                    'user_id' => $log->user_id,
                    'action' => $log->action,
                    'ip_address' => $log->ip_address,
                    'created_at' => $log->created_at?->toIso8601String(),
                    'deleted_at' => $log->deleted_at?->toIso8601String(),
                    'user' => $log->user ? [
                        'id' => $log->user->id,
                        'fullname' => $log->user->fullname,
                        'email' => $log->user->email,
                        'role' => $log->user->role,
                        'department' => $log->user->department,
                    ] : null,
                ];
            });
        return response()->json(['recently_deleted' => $deleted]);
    });

    // Restore a deleted audit log
    Route::post('/audit-logs/{id}/restore', function (Request $request, int $id) {
        $log = \App\Models\AuditLog::onlyTrashed()->findOrFail($id);
        $log->restore();
        return response()->json(['message' => 'Audit log restored']);
    });

    // Permanently delete an audit log
    Route::delete('/audit-logs/{id}/permanent', function (Request $request, int $id) {
        $log = \App\Models\AuditLog::onlyTrashed()->findOrFail($id);
        $log->forceDelete();
        return response()->json(['message' => 'Audit log permanently deleted']);
        $deleted = AuditLog::whereIn('user_id', $userIds)->delete();

        return response()->json(['deleted' => $deleted]);
    });

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

        if ($type === 'quiz') {
            $query = \App\Models\QuizFeedback::with([
                'user:id,fullname,department,role',
                'quiz.module.course:id,title,department,instructor_id',
            ])
            ->whereHas('quiz.module.course', function ($q) use ($instructorId) {
                $q->where('instructor_id', $instructorId);
            })
            ->orderByDesc('created_at');

            $perPage = max(10, min(200, (int) $request->get('per_page', 50)));
            $page = $query->paginate($perPage);

            return response()->json($page->through(function ($fb) {
                return [
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
        Route::post('/{id}/read', [\App\Http\Controllers\NotificationController::class, 'markAsRead']);
        Route::post('/read-all', [\App\Http\Controllers\NotificationController::class, 'markAllAsRead']);
        Route::delete('/{id}', [\App\Http\Controllers\NotificationController::class, 'destroy']);
        Route::post('/{id}/restore', [\App\Http\Controllers\NotificationController::class, 'restoreNotification']);
        Route::delete('/{id}/permanent', [\App\Http\Controllers\NotificationController::class, 'permanentlyDeleteNotification']);
        Route::post('/notify-instructor', [\App\Http\Controllers\NotificationController::class, 'employeeNotifyInstructor']);
        Route::post('/report-admin', [\App\Http\Controllers\NotificationController::class, 'employeeReportToAdmin']);
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
            'signature' => 'required|image|mimes:jpeg,jpg,png|max:2048|dimensions:max_width=3000,max_height=1200',
        ]);

        // Replace any previous signature file.
        if ($user->signature_path && \Illuminate\Support\Facades\Storage::disk('public')->exists($user->signature_path)) {
            \Illuminate\Support\Facades\Storage::disk('public')->delete($user->signature_path);
        }

        $ext = strtolower($request->file('signature')->getClientOriginalExtension());
        $filename = (string) \Illuminate\Support\Str::uuid().'.'.$ext;
        $path = $request->file('signature')->storeAs('signatures', $filename, 'public');

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
