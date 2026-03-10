<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Http\Controllers\LoginController;
use App\Http\Controllers\YouTubeController;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
*/

Route::get('/', function () {
    return view('welcome');
});

// =====================
// LOGIN (Session-based for SPA)
// =====================
Route::post('/login', [LoginController::class, 'login']);

// =====================
// LOGOUT
// =====================
Route::post('/logout', [LoginController::class, 'logout'])->middleware('auth');

// =====================
// GET AUTH USER
// =====================
Route::get('/user', [LoginController::class, 'user'])->middleware('auth');

// =====================
// YOUTUBE API INTEGRATION
// =====================
Route::get('/youtube', [YouTubeController::class, 'index'])->name('youtube.index');
Route::get('/youtube/callback', [YouTubeController::class, 'callback'])->name('youtube.callback');
Route::post('/youtube/logout', [YouTubeController::class, 'logout'])->name('youtube.logout');
// Upload route for instructors/admins (uses session auth)
Route::post('/youtube/upload', [YouTubeController::class, 'uploadVideo'])->middleware('auth');
