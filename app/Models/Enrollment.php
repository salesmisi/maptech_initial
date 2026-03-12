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
        'locked',
    ];

    protected $casts = [
        'enrolled_at' => 'datetime',
        'locked' => 'boolean',
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

        // Auto-generate certificate when course is completed
        if ($progress >= 100) {
            static::generateCertificate($userId, $courseId, $course, $quizzes, $quizIds);
        }
    }

    /**
     * Generate a certificate for a completed course if one doesn't already exist.
     */
    private static function generateCertificate(int $userId, string $courseId, Course $course, $quizzes, $quizIds): void
    {
        if (Certificate::where('user_id', $userId)->where('course_id', $courseId)->exists()) {
            return;
        }

        // Calculate average score across all passed quizzes
        $avgScore = QuizAttempt::where('user_id', $userId)
            ->whereIn('quiz_id', $quizIds)
            ->where('passed', true)
            ->selectRaw('MAX(percentage) as best_pct, quiz_id')
            ->groupBy('quiz_id')
            ->get()
            ->avg('best_pct') ?? 0;

        $now = now();
        $code = Certificate::generateCode($course->title, $now);

        // Ensure unique code
        while (Certificate::where('certificate_code', $code)->exists()) {
            $code = Certificate::generateCode($course->title, $now);
        }

        Certificate::create([
            'user_id'          => $userId,
            'course_id'        => $courseId,
            'certificate_code' => $code,
            'completed_at'     => $now,
            'score'            => round($avgScore, 2),
        ]);
    }
}
