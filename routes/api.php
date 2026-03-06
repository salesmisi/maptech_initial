<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Models\Department;
use App\Models\Subdepartment;

/*
|--------------------------------------------------------------------------
| DEPARTMENT ROUTES
|--------------------------------------------------------------------------
*/

// GET ALL DEPARTMENTS (with subdepartments)
Route::get('/departments', function () {
    return Department::with('subdepartments')->orderBy('id', 'asc')->get();
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
        'name' => 'required|string|max:255'
    ]);

    return Subdepartment::create([
        'department_id' => $id,
        'name' => $request->name,
        'description' => $request->description
    ]);
});

// UPDATE SUBDEPARTMENT
Route::put('/subdepartments/{id}', function (Request $request, $id) {

    $subdepartment = Subdepartment::findOrFail($id);

    $request->validate([
        'name' => 'required|string|max:255'
    ]);

    $subdepartment->update([
        'name' => $request->name,
    ]);

    return $subdepartment;
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
use App\Http\Controllers\QAController;

// Test route for debugging
Route::get('/test-auth', function () {
    return response()->json([
        'message' => 'API is working',
        'timestamp' => now(),
        'user' => auth()->user() ? [
            'id' => auth()->user()->id,
            'name' => auth()->user()->fullName,
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
    Route::get('/courses/{id}/students', [AdminCourseController::class, 'getEnrolledStudents']);
    Route::post('/courses/{id}/enroll', [AdminCourseController::class, 'enrollStudent']);
    Route::delete('/courses/{courseId}/students/{userId}', [AdminCourseController::class, 'unenrollStudent']);

    // Send Quiz to Department-Filtered Students
    Route::post('/courses/{id}/send-quiz', [AdminCourseController::class, 'sendQuiz']);

    // Q&A – admin manage answers
    Route::get('/questions', [QAController::class, 'adminIndex']);
    Route::post('/questions/{id}/answer', [QAController::class, 'adminAnswer']);
    Route::delete('/questions/{id}/answer', [QAController::class, 'adminDeleteAnswer']);

    // Q&A replies
    Route::post('/questions/{id}/replies', [QAController::class, 'storeReply']);
    Route::delete('/questions/{questionId}/replies/{replyId}', [QAController::class, 'destroyReply']);
    Route::post('/questions/{questionId}/replies/{replyId}/reactions', [QAController::class, 'toggleReaction']);
});


/*
|--------------------------------------------------------------------------
| INSTRUCTOR ROUTES - Role: Instructor Only
|--------------------------------------------------------------------------
*/

use App\Http\Controllers\Instructor\CourseController as InstructorCourseController;

Route::prefix('instructor')->middleware(['auth:sanctum', 'status', 'role:Instructor'])->group(function () {

    // Dashboard
    Route::get('/dashboard', [InstructorCourseController::class, 'dashboard']);

    // Instructor's own courses
    Route::get('/courses', [InstructorCourseController::class, 'index']);
    Route::put('/courses/{id}', [InstructorCourseController::class, 'update']);

    // Q&A – instructor answers questions for their courses
    Route::get('/questions', [QAController::class, 'instructorIndex']);
    Route::post('/questions/{id}/answer', [QAController::class, 'adminAnswer']);
    Route::delete('/questions/{id}/answer', [QAController::class, 'adminDeleteAnswer']);

    // Q&A replies
    Route::post('/questions/{id}/replies', [QAController::class, 'storeReply']);
    Route::delete('/questions/{questionId}/replies/{replyId}', [QAController::class, 'destroyReply']);
    Route::post('/questions/{questionId}/replies/{replyId}/reactions', [QAController::class, 'toggleReaction']);
});


/*
|--------------------------------------------------------------------------
| EMPLOYEE ROUTES - Role: Employee Only + Department Access
|--------------------------------------------------------------------------
*/

use App\Http\Controllers\Employee\DashboardController;

Route::prefix('employee')->middleware(['auth:sanctum', 'status', 'role:Employee', 'department'])->group(function () {

    // Dashboard (auto-filtered by department)
    Route::get('/dashboard', [DashboardController::class, 'index']);

    // Courses (auto-filtered by department)
    Route::get('/courses', [DashboardController::class, 'courses']);
    Route::get('/courses/{id}', [DashboardController::class, 'showCourse']);

    // Notifications
    Route::get('/notifications', [DashboardController::class, 'notifications']);
    Route::put('/notifications/{id}/read', [DashboardController::class, 'markNotificationRead']);

    // My Progress
    Route::get('/progress', [DashboardController::class, 'progress']);
    Route::post('/modules/{moduleId}/quiz', [DashboardController::class, 'saveQuizAttempt']);

    // Q&A – employee questions
    Route::get('/questions', [QAController::class, 'employeeIndex']);
    Route::post('/questions', [QAController::class, 'employeeStore']);
    Route::put('/questions/{id}', [QAController::class, 'employeeUpdate']);
    Route::delete('/questions/{id}', [QAController::class, 'employeeDestroy']);

    // Q&A replies
    Route::post('/questions/{id}/replies', [QAController::class, 'storeReply']);
    Route::delete('/questions/{questionId}/replies/{replyId}', [QAController::class, 'destroyReply']);
    Route::post('/questions/{questionId}/replies/{replyId}/reactions', [QAController::class, 'toggleReaction']);
});

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
            'fullName' => $user->fullName,
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

        // Strip email and password if a non-admin somehow submitted them
        if (!$user->isAdmin()) {
            unset($validated['email']);
            unset($validated['password']);
        }

        if (isset($validated['password'])) {
            $validated['password'] = bcrypt($validated['password']);
        }

        $user->update($validated);

        return response()->json([
            'message' => 'Profile updated successfully.',
            'user' => [
                'id' => $user->id,
                'fullName' => $user->fullName,
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

