<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Models\Department;
use App\Models\Subdepartment;
use App\Models\AuditLog;

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


/*
|--------------------------------------------------------------------------
| ADMIN ROUTES - Role: Admin Only
|--------------------------------------------------------------------------
*/

use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Admin\CourseController as AdminCourseController;
use App\Http\Controllers\Admin\ReportController;
use App\Http\Controllers\Admin\QuizController as AdminQuizController;

// Test route for debugging
Route::get('/test-auth', function () {
    return response()->json([
        'message' => 'API is working',
        'timestamp' => now(),
        'user' => auth()->user() ? [
            'id' => auth()->user()->id,
            'name' => auth()->user()->fullname,
            'role' => auth()->user()->role,
            'status' => auth()->user()->status,
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

    // Course Management (Admin can manage all courses)
    Route::get('/courses', [AdminCourseController::class, 'index']);
    Route::post('/courses', [AdminCourseController::class, 'store']);
    Route::get('/courses/{id}', [AdminCourseController::class, 'show']);
    Route::put('/courses/{id}', [AdminCourseController::class, 'update']);
    Route::delete('/courses/{id}', [AdminCourseController::class, 'destroy']);

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
        $query = AuditLog::with('user:id,fullname,email,role,department')
            ->orderByDesc('created_at');

        if ($request->has('user_id')) {
            $query->where('user_id', $request->user_id);
        }

        return $query->paginate(50);
    });
});


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
    Route::post('/feedbacks', [\App\Http\Controllers\Employee\FeedbackController::class, 'store']);
    Route::put('/feedbacks/{id}', [\App\Http\Controllers\Employee\FeedbackController::class, 'update']);
    Route::delete('/feedbacks/{id}', [\App\Http\Controllers\Employee\FeedbackController::class, 'destroy']);
    Route::get('/enrolled-lessons', [\App\Http\Controllers\Employee\FeedbackController::class, 'enrolledLessons']);

    // Quiz taking
    Route::get('/quizzes/{quizId}', [EmployeeQuizController::class, 'show']);
    Route::post('/quizzes/{quizId}/submit', [EmployeeQuizController::class, 'submit']);
    Route::get('/quizzes/{quizId}/attempts', [EmployeeQuizController::class, 'myAttempts']);

    // Q&A (Employee)
    Route::get('/questions', [\App\Http\Controllers\QAController::class, 'employeeIndex']);
    Route::post('/questions', [\App\Http\Controllers\QAController::class, 'employeeStore']);
    Route::put('/questions/{id}', [\App\Http\Controllers\QAController::class, 'employeeUpdate']);
    Route::delete('/questions/{id}', [\App\Http\Controllers\QAController::class, 'employeeDestroy']);
    Route::post('/questions/{id}/replies', [\App\Http\Controllers\QAController::class, 'storeReply']);
    Route::delete('/questions/{questionId}/replies/{replyId}', [\App\Http\Controllers\QAController::class, 'destroyReply']);
    Route::post('/questions/{questionId}/replies/{replyId}/reactions', [\App\Http\Controllers\QAController::class, 'toggleReaction']);
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
            'fullName' => $user->fullname,
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

        // Map fullName to fullname (actual DB column)
        if (isset($validated['fullName'])) {
            $validated['fullname'] = $validated['fullName'];
            unset($validated['fullName']);
        }

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

        return response()->json([
            'message' => 'Profile updated successfully.',
            'user' => [
                'id' => $user->id,
                'fullName' => $user->fullname,
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
});

