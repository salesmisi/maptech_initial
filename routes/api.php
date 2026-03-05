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
    return Department::with('subdepartments')->get();
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
use App\Http\Controllers\Admin\QuizController as AdminQuizController;

Route::prefix('admin')->middleware(['auth:sanctum', 'status', 'role:Admin'])->group(function () {

    // Dashboard
    Route::get('/dashboard', [UserController::class, 'dashboard']);

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
    Route::get('/courses/{id}/enrollments', [AdminCourseController::class, 'enrollments']);
    Route::post('/courses/{id}/enrollments', [AdminCourseController::class, 'enroll']);
    Route::delete('/courses/{courseId}/enrollments/{userId}', [AdminCourseController::class, 'unenroll']);

    // Course Module Management
    Route::post('/courses/{id}/modules', [AdminCourseController::class, 'addModule']);
    Route::delete('/courses/{courseId}/modules/{moduleId}', [AdminCourseController::class, 'deleteModule']);

    // Lesson Management
    Route::post('/modules/{moduleId}/lessons', [AdminCourseController::class, 'addLesson']);
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
    Route::delete('/courses/{courseId}/modules/{moduleId}', [InstructorCourseController::class, 'deleteModule']);

    // Lesson Management
    Route::post('/modules/{moduleId}/lessons', [InstructorCourseController::class, 'addLesson']);
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
});


/*
|--------------------------------------------------------------------------
| EMPLOYEE ROUTES - Role: Employee Only + Department Access
|--------------------------------------------------------------------------
*/

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

    // Quiz taking
    Route::get('/quizzes/{quizId}', [EmployeeQuizController::class, 'show']);
    Route::post('/quizzes/{quizId}/submit', [EmployeeQuizController::class, 'submit']);
    Route::get('/quizzes/{quizId}/attempts', [EmployeeQuizController::class, 'myAttempts']);
});

/*
|--------------------------------------------------------------------------
| MODULE CONTENT ROUTES - Authenticated Users Only
|--------------------------------------------------------------------------
*/

// Serve module content for authenticated users
Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/modules/{module}/content', function (\App\Models\Module $module) {
        $path = storage_path('app/public/' . $module->content_path);

        if (!file_exists($path)) {
            return response()->json(['message' => 'File not found'], 404);
        }

        return response()->file($path);
    });
});

