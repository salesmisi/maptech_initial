<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Http\Controllers\LoginController;
use App\Http\Controllers\ReadOnlyLoginController;
use App\Http\Controllers\YouTubeController;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
*/

Route::get('/', function () {
    return view('welcome');
});

// Admin notification creation page (web)
Route::get('/admin/notifications/create', function () {
    return view('admin.notifications.create');
})->middleware(['auth', 'role:Admin']);

// =====================
// READ-ONLY LOGIN (session-based)
// Uses only DB reads; does not modify records.
// =====================
Route::post('/login', [ReadOnlyLoginController::class, 'login']);
Route::post('/logout', [ReadOnlyLoginController::class, 'logout']);
Route::get('/user', [ReadOnlyLoginController::class, 'user']);

// =====================
// YOUTUBE API INTEGRATION
// =====================
Route::get('/youtube', [YouTubeController::class, 'index'])->name('youtube.index');
Route::get('/youtube/callback', [YouTubeController::class, 'callback'])->name('youtube.callback');
Route::post('/youtube/logout', [YouTubeController::class, 'logout'])->name('youtube.logout');
