<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Course;
use App\Models\Quiz;
use App\Models\QuizAttempt;

/**
 * @property int $id
 * @property int $user_id
 * @property string $course_id
 * @property string $status
 * @property int $progress
 * @property \Illuminate\Support\Carbon $enrolled_at
 */
class Enrollment extends Model
{
    protected $fillable = [
        'user_id',
        'course_id',
        'status',
        'progress',
        'enrolled_at',
    ];

    protected $casts = [
        'enrolled_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    /**
     * Recalculate and persist progress + status for a given user/course enrollment.
     * Progress = (modules with passed quiz / total modules with quiz) * 100.
     */
    public static function recalculateProgress(int $userId, string $courseId): void
    {
        $enrollment = static::where('user_id', $userId)
            ->where('course_id', $courseId)
            ->first();

        if (!$enrollment) return;

        $course = Course::with('modules')->find($courseId);
        if (!$course) return;

        $moduleIds = $course->modules->pluck('id');

        $quizzes = Quiz::whereIn('module_id', $moduleIds)->get();

        if ($quizzes->isEmpty()) {
            $enrollment->update(['progress' => 100, 'status' => 'Completed']);
            return;
        }

        $totalQuizzes = $quizzes->count();
        $quizIds = $quizzes->pluck('id');

        $passedCount = QuizAttempt::where('user_id', $userId)
            ->whereIn('quiz_id', $quizIds)
            ->where('passed', true)
            ->distinct('quiz_id')
            ->count('quiz_id');

        $progress = (int) round(($passedCount / $totalQuizzes) * 100);

        $status = 'Not Started';
        if ($progress >= 100) {
            $status = 'Completed';
        } elseif ($progress > 0) {
            $status = 'In Progress';
        } elseif (QuizAttempt::where('user_id', $userId)->whereIn('quiz_id', $quizIds)->exists()) {
            $status = 'In Progress';
        }

        $enrollment->update([
            'progress' => $progress,
            'status'   => $status,
        ]);
    }
}
