<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Models\Department;
use App\Models\Subdepartment;
use App\Models\AuditLog;
use Illuminate\Support\Carbon;

/*
|--------------------------------------------------------------------------
| DEPARTMENT ROUTES
|--------------------------------------------------------------------------
*/

// GET ALL DEPARTMENTS (with subdepartments and head user)
Route::get('/departments', function () {
    return Department::with([
        'subdepartments.headUser:id,fullname',
        'subdepartments.employee:id,fullname',
        'headUser:id,fullname'
    ])->get();
});

// CREATE DEPARTMENT
Route::post('/departments', function (Request $request) {

    $request->validate([
        'name' => 'required|string|max:255',
        'code' => 'required|string|max:50|unique:departments,code',
    ]);

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
        'message' => 'Department deleted successfully'
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

    $subdepartment = Subdepartment::create([
        'department_id' => $id,
        'name' => $request->name,
        'description' => $request->description,
        'head_id' => $request->head_id,
        'employee_id' => $request->employee_id,
    ]);

    return $subdepartment->load(['headUser:id,fullname', 'employee:id,fullname']);
});

// UPDATE SUBDEPARTMENT
Route::put('/subdepartments/{id}', function (Request $request, $id) {

    $subdepartment = Subdepartment::findOrFail($id);

    $request->validate([
        'name' => 'required|string|max:255',
        'head_id' => 'nullable|exists:users,id',
        'employee_id' => 'nullable|exists:users,id',
    ]);

    $subdepartment->update([
        'name' => $request->name,
        'head_id' => $request->head_id,
        'employee_id' => $request->employee_id,
    ]);

    return $subdepartment->load(['headUser:id,fullname', 'employee:id,fullname']);
});

// DELETE SUBDEPARTMENT
Route::delete('/subdepartments/{id}', function ($id) {

    Subdepartment::findOrFail($id)->delete();

    return response()->json([
        'message' => 'Subdepartment deleted successfully'
    ]);
});


/*
|--------------------------------------------------------------------------
| AUTHENTICATION ROUTES
|--------------------------------------------------------------------------
*/

use App\Http\Controllers\LoginController;

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
    if (!$user) {
        return response()->json(['message' => 'Unauthenticated'], 401);
    }

    $logs = AuditLog::where('user_id', $user->id)
        ->with('user:id,fullname,email,role,department')
        ->orderByDesc('created_at')
        ->get();

    // Return ISO8601 UTC timestamps
    $data = $logs->map(function ($log) {
        return [
            'id' => $log->id,
            'user_id' => $log->user_id,
            'action' => $log->action,
            'ip_address' => $log->ip_address,
            'created_at' => optional($log->created_at)->toIso8601String(),
            'updated_at' => optional($log->updated_at)->toIso8601String(),
        ];
    });
    return response()->json(['data' => $data]);
})->middleware(['auth:sanctum', 'status']);


/*
|--------------------------------------------------------------------------
| ADMIN ROUTES - Role: Admin Only
|--------------------------------------------------------------------------
*/

use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Admin\CourseController as AdminCourseController;
use App\Http\Controllers\Admin\ReportController;
use App\Http\Controllers\Admin\QuizController as AdminQuizController;
use App\Http\Controllers\AnalyticsController;

// Test route for debugging
Route::get('/test-auth', function () {
    $user = request()->user();
    return response()->json([
        'message' => 'API is working',
        'timestamp' => Carbon::now()->utc()->toIso8601String(),
        'user' => $user ? [
            'id' => $user->id,
            'name' => $user->fullname,
            'role' => $user->role,
            'status' => $user->status,
        ] : null
    ]);
});

Route::prefix('admin')->middleware(['auth:sanctum', 'status', 'role:Admin'])->group(function () {

    // Dashboard
    Route::get('/dashboard', [UserController::class, 'dashboard']);
    Route::get('/activity', [UserController::class, 'activity']);

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
    Route::get('/courses/{id}/enrollments', [AdminCourseController::class, 'enrollments']);
    Route::post('/courses/{id}/enrollments', [AdminCourseController::class, 'enroll']);
    Route::delete('/courses/{courseId}/enrollments/{userId}', [AdminCourseController::class, 'unenroll']);

    // Course Module Management
    Route::post('/courses/{id}/modules', [AdminCourseController::class, 'addModule']);
    Route::put('/courses/{courseId}/modules/{moduleId}', [AdminCourseController::class, 'updateModule']);
    Route::delete('/courses/{courseId}/modules/{moduleId}', [AdminCourseController::class, 'deleteModule']);
    Route::post('/courses/{courseId}/modules/reorder', [AdminCourseController::class, 'reorderModules']);

    // Lesson Management
    Route::post('/modules/{moduleId}/lessons', [AdminCourseController::class, 'addLesson']);
    Route::post('/modules/{moduleId}/lessons/{lessonId}', [AdminCourseController::class, 'updateLesson']);
    Route::delete('/modules/{moduleId}/lessons/{lessonId}', [AdminCourseController::class, 'deleteLesson']);

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
    Route::post('/questions/{id}/answer', [\App\Http\Controllers\QAController::class, 'adminAnswer']);
    Route::delete('/questions/{id}/answer', [\App\Http\Controllers\QAController::class, 'adminDeleteAnswer']);
    Route::post('/questions/{id}/replies', [\App\Http\Controllers\QAController::class, 'storeReply']);
    Route::delete('/questions/{questionId}/replies/{replyId}', [\App\Http\Controllers\QAController::class, 'destroyReply']);
    Route::post('/questions/{questionId}/replies/{replyId}/reactions', [\App\Http\Controllers\QAController::class, 'toggleReaction']);

    // Audit Logs
    Route::get('/audit-logs', function (Request $request) {
        // Get all audit logs as before
        $query = AuditLog::with('user:id,fullname,email,role,department')
            ->orderByDesc('created_at');

        // Optional filters
        $roleFilter = null;
        if ($request->filled('role')) {
            $roleFilter = strtolower($request->input('role'));
            if (!in_array($roleFilter, ['admin', 'instructor', 'employee'])) {
                return response()->json(['message' => 'Invalid role filter'], 422);
            }
            // Filter audit logs by the user's role
            $query->whereHas('user', function ($q) use ($roleFilter) {
                $q->whereRaw('LOWER(role) = ?', [$roleFilter]);
            });
        }

        if ($request->has('user_id')) {
            $query->where('user_id', $request->user_id);
        }

        $logs = $query->get();

        // Add latest open login for every user (if not already present)
        // Respect the role filter when collecting user ids
        $userQuery = \App\Models\User::query();
        if ($roleFilter) {
            $userQuery->whereRaw('LOWER(role) = ?', [$roleFilter]);
        }
        $userIds = $userQuery->pluck('id');
        foreach ($userIds as $uid) {
            $latestLogin = AuditLog::where('user_id', $uid)
                ->where('action', 'login')
                ->orderByDesc('created_at')
                ->first();

            $latestLogoutQuery = AuditLog::where('user_id', $uid)
                ->where('action', 'logout');
            if ($latestLogin && $latestLogin->created_at) {
                $latestLogoutQuery->where('created_at', '>=', $latestLogin->created_at);
            }
            $latestLogout = $latestLogoutQuery->orderByDesc('created_at')->first();
            if ($latestLogin && (!$latestLogout || $latestLogout->created_at < $latestLogin->created_at)) {
                if (!$logs->contains('id', $latestLogin->id)) {
                    $logs->push($latestLogin->load('user:id,fullname,email,role,department'));
                }
            }
        }

        // For each login event, attach the matching time_log (by user_id and closest time_in to created_at)
        $logs = $logs->map(function ($log) {
            if ($log->action === 'login') {
                if ($log->created_at) {
                    $start = $log->created_at->copy()->subMinutes(2);
                    $end = $log->created_at->copy()->addMinutes(2);
                    $timeLog = \App\Models\TimeLog::where('user_id', $log->user_id)
                        ->whereBetween('time_in', [$start, $end])
                        ->orderBy('time_in')
                        ->first();
                } else {
                    $timeLog = null;
                }
                $log->time_log = $timeLog;
            } else {
                $log->time_log = null;
            }
            return $log;
        });

        // Sort logs by created_at desc
        $logs = $logs->sortByDesc('created_at')->values();

        // Normalize user payloads: ensure `user` exists and has `fullname` (handle camelCase `fullName` column in local DB)
        $logs = $logs->map(function ($log) {
            if (!$log->user && $log->user_id) {
                $u = \App\Models\User::find($log->user_id);
                if ($u) {
                    $log->user = (object) [
                        'id' => $u->id,
                        'fullname' => $u->fullName ?? $u->fullname ?? $u->name ?? null,
                        'email' => $u->email,
                        'role' => $u->role,
                        'department' => $u->department,
                    ];
                }
            } else if ($log->user) {
                // ensure fullname property exists even if returned as fullName
                $user = $log->user;
                $user->fullname = $user->fullname ?? ($user->fullName ?? ($user->name ?? null));
                $log->user = $user;
            }
            return $log;
        });

        // Paginate manually
        $perPage = 50;
        $page = max(1, (int)$request->input('page', 1));
        $total = $logs->count();
        $paged = $logs->slice(($page - 1) * $perPage, $perPage)->values();

        return response()->json([
            'data' => $paged,
            'current_page' => $page,
            'last_page' => ceil($total / $perPage),
            'total' => $total,
            'per_page' => $perPage,
        ]);
    });
    // Bulk delete audit logs by id
    Route::post('/audit-logs/bulk-delete', function (Request $request) {
        $request->validate([
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer|exists:audit_logs,id'
        ]);
        $ids = $request->input('ids', []);
        $deleted = \App\Models\AuditLog::whereIn('id', $ids)->delete();
        return response()->json(['deleted' => $deleted]);
    });

    // Bulk delete audit logs by user ids (delete all logs for selected users)
    Route::post('/audit-logs/bulk-delete-by-users', function (Request $request) {
        $request->validate([
            'user_ids' => 'required|array|min:1',
            'user_ids.*' => 'integer|exists:users,id'
        ]);
        $userIds = $request->input('user_ids', []);
        $deleted = \App\Models\AuditLog::whereIn('user_id', $userIds)->delete();
        return response()->json(['deleted' => $deleted]);
    });

    // Notification Management (Admin)
    Route::prefix('notifications')->group(function () {
        Route::get('/', [\App\Http\Controllers\NotificationController::class, 'index']);
        Route::get('/unread-count', [\App\Http\Controllers\NotificationController::class, 'unreadCount']);
        Route::post('/{id}/read', [\App\Http\Controllers\NotificationController::class, 'markAsRead']);
        Route::post('/read-all', [\App\Http\Controllers\NotificationController::class, 'markAllAsRead']);
        Route::delete('/{id}', [\App\Http\Controllers\NotificationController::class, 'destroy']);
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
});

// Public (authenticated) endpoint to record lesson events (play/pause/progress)
Route::post('/lesson-events', [AnalyticsController::class, 'recordLessonEvent'])->middleware(['auth:sanctum', 'status']);

// Admin: get recent lesson events (optionally filter by lesson or user)
Route::get('/admin/lesson-events', [AnalyticsController::class, 'recentLessonEvents'])->middleware(['auth:sanctum', 'status', 'role:Admin']);

if (env('APP_ENV') === 'local') {
    Route::get('/dev/create-it-test', function () {
        $u = \App\Models\User::firstOrCreate([
            'email' => 'it-test@example.com'
        ], [
            'fullname' => 'IT Tester',
            'password' => bcrypt('password'),
            'role' => 'employee',
            'department' => 'IT',
            'status' => 'Active',
        ]);

        $s = \App\Models\User::firstOrCreate([
            'email' => 'student-test@example.com'
        ], [
            'fullname' => 'Student Tester',
            'password' => bcrypt('password'),
            'role' => 'employee',
            'department' => 'IT',
            'status' => 'Active',
        ]);

        $course = \App\Models\Course::firstOrCreate([
            'title' => 'IT Test Course'
        ], [
            'description' => 'Test course',
            'department' => 'IT',
            'status' => 'Active',
        ]);

        if (!\App\Models\Enrollment::where('course_id', $course->id)->where('user_id', $s->id)->exists()) {
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
            'email' => 'dev-admin@example.com'
        ], [
            'fullname' => 'Dev Admin',
            'password' => bcrypt('password'),
            'role' => 'admin',
            'department' => 'IT',
            'status' => 'Active',
        ]);

        $u1 = \App\Models\User::firstOrCreate([
            'email' => 'dev-user1@example.com'
        ], [
            'fullname' => 'Dev User 1',
            'password' => bcrypt('password'),
            'role' => 'employee',
            'department' => 'IT',
            'status' => 'Active',
        ]);

        $u2 = \App\Models\User::firstOrCreate([
            'email' => 'dev-user2@example.com'
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

    // Users list (for enrollment dropdown)
    Route::get('/users', [InstructorCourseController::class, 'listUsers']);

    // Lesson Management
    Route::post('/modules/{moduleId}/lessons', [InstructorCourseController::class, 'addLesson']);
    Route::post('/modules/{moduleId}/lessons/{lessonId}', [InstructorCourseController::class, 'updateLesson']);
    Route::delete('/modules/{moduleId}/lessons/{lessonId}', [InstructorCourseController::class, 'deleteLesson']);

    // Quiz Management
    Route::get('/quizzes', [InstructorQuizController::class, 'index']);
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
        Route::post('/{id}/read', [\App\Http\Controllers\NotificationController::class, 'markAsRead']);
        Route::post('/read-all', [\App\Http\Controllers\NotificationController::class, 'markAllAsRead']);
        Route::delete('/{id}', [\App\Http\Controllers\NotificationController::class, 'destroy']);
        Route::post('/notify-employees', [\App\Http\Controllers\NotificationController::class, 'instructorNotify']);
    });
    // Instructor access to feedback listing (uses same controller logic)
    Route::get('/feedbacks', [\App\Http\Controllers\Admin\FeedbackController::class, 'index']);
});


/*
|--------------------------------------------------------------------------
| EMPLOYEE ROUTES - Role: Employee Only + Department Access
|--------------------------------------------------------------------------
*/

use App\Http\Controllers\Employee\DashboardController;
use App\Http\Controllers\Employee\QuizController as EmployeeQuizController;
use App\Http\Controllers\Employee\CertificateController;

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
        Route::post('/{id}/read', [\App\Http\Controllers\NotificationController::class, 'markAsRead']);
        Route::post('/read-all', [\App\Http\Controllers\NotificationController::class, 'markAllAsRead']);
        Route::delete('/{id}', [\App\Http\Controllers\NotificationController::class, 'destroy']);
        Route::post('/notify-instructor', [\App\Http\Controllers\NotificationController::class, 'employeeNotifyInstructor']);
        Route::post('/report-admin', [\App\Http\Controllers\NotificationController::class, 'employeeReportToAdmin']);
    });
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

// Serve module content for authenticated users
Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/modules/{module}/content', function (\App\Models\Module $module) {
        $path = storage_path('app/public/' . $module->content_path);

        if (!file_exists($path)) {
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
            'department' => $user->department,
            'status' => $user->status,
            'profile_picture' => $user->profile_picture ? asset('storage/' . $user->profile_picture) : null,
        ]);
    });

    Route::post('/profile', function (Request $request) {
        $user = $request->user();

        $rules = [
            'fullName' => 'sometimes|string|max:255',
        ];

        // Only admins can change email and password
        if ($user->isAdmin()) {
            $rules['email'] = 'sometimes|email|max:255|unique:users,email,' . $user->id;
            $rules['password'] = 'sometimes|string|min:8|confirmed';
        }

        $validated = $request->validate($rules);

        // Keep `fullName` as provided (some databases use camelCase column names).
        // Also support legacy lowercase `fullname` where present by leaving both keys alone.

        // Strip email and password if a non-admin somehow submitted them
        if (!$user->isAdmin()) {
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
            $ts = \Illuminate\Support\Carbon::now()->utc();
            $log = \App\Models\AuditLog::create([
                'user_id' => $user->id,
                'action' => 'profile_updated',
                'ip_address' => $request->ip(),
                'created_at' => $ts,
            ]);
            event(new \App\Events\AuditLogCreated($log));
        } catch (\Exception $e) {
            // Log and continue — do not break the profile update flow
            \Illuminate\Support\Facades\Log::warning('Failed to create AuditLog for profile update', ['error' => $e->getMessage()]);
        }

        return response()->json([
            'message' => 'Profile updated successfully.',
            'user' => [
                'id' => $user->id,
                // Prefer camelCase DB column `fullName` but fall back to `fullname` if present
                'fullName' => $user->fullName ?? $user->fullname,
                'email' => $user->email,
                'role' => $user->role,
                'department' => $user->department,
                'profile_picture' => $user->profile_picture ? asset('storage/' . $user->profile_picture) : null,
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
            'profile_picture' => asset('storage/' . $path),
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
});

