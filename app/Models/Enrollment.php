<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use App\Models\Course;
use App\Models\Lesson;
use App\Models\LessonEvent;
use App\Models\Module;
use App\Models\ProductLogo;
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

        // Use DB-allowed status values (lowercase). Default to 'active' for not-completed enrollments.
        $status = 'active';
        if ($progress >= 100) {
            $status = 'completed';
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
            'logo_path'        => static::resolveLogoPath($userId, $course, $quizzes),
        ]);
    }

    /**
     * Public helper for resolving certificate logo path for an existing user+course.
     * Used by one-time backfill commands to keep logic aligned with certificate generation.
     */
    public static function resolveCertificateLogoPathForUserCourse(int $userId, string $courseId): ?string
    {
        $course = Course::find($courseId);
        if (!$course) {
            return null;
        }

        $moduleIds = Module::where('course_id', $courseId)->pluck('id');
        $quizzes = Quiz::whereIn('module_id', $moduleIds)->get();

        return static::resolveLogoPath($userId, $course, $quizzes);
    }

    /**
     * Resolve the certificate logo from product logo mappings.
     * Falls back to the course logo when no module/lesson mapping exists.
     */
    private static function resolveLogoPath(int $userId, Course $course, $quizzes): ?string
    {
        $moduleIds = $quizzes->pluck('module_id')->filter()->unique()->values()->all();
        $quizIds = $quizzes->pluck('id')->filter()->unique()->values()->all();

        // Most specific match: employee's latest passed module in this course.
        $latestPassed = QuizAttempt::where('user_id', $userId)
            ->where('passed', true)
            ->whereIn('quiz_id', $quizIds)
            ->with('quiz:id,module_id')
            ->orderByDesc('created_at')
            ->first();

        $completedModuleId = $latestPassed?->quiz?->module_id;
        if (!empty($completedModuleId)) {
            $completedModuleLogo = Module::where('id', $completedModuleId)
                ->whereNotNull('logo_path')
                ->value('logo_path');

            if (!empty($completedModuleLogo)) {
                return $completedModuleLogo;
            }
        }

        // Lesson completion fallback: use the latest completion-like lesson event for this course.
        $lessonIdsInCourse = Lesson::whereIn('module_id', function ($query) use ($course) {
            $query->select('id')->from('modules')->where('course_id', $course->id);
        })->pluck('id')->all();

        if (!empty($lessonIdsInCourse)) {
            $latestLessonEvent = LessonEvent::where('user_id', $userId)
                ->whereIn('lesson_id', $lessonIdsInCourse)
                ->whereIn('event_type', ['lesson_completed', 'lesson_complete', 'completed', 'yt_end'])
                ->orderByDesc('created_at')
                ->first();

            if (!empty($latestLessonEvent?->lesson_id)) {
                $lessonLogo = ProductLogo::where('lesson_id', $latestLessonEvent->lesson_id)
                    ->orderByDesc('id')
                    ->value('file_path');

                if (!empty($lessonLogo)) {
                    return $lessonLogo;
                }

                $lessonModuleLogo = Module::where('id', function ($query) use ($latestLessonEvent) {
                    $query->select('module_id')->from('lessons')->where('id', $latestLessonEvent->lesson_id)->limit(1);
                })->whereNotNull('logo_path')->value('logo_path');

                if (!empty($lessonModuleLogo)) {
                    return $lessonModuleLogo;
                }
            }
        }

        // Primary source: direct logo assignment on modules table.
        if (!empty($moduleIds)) {
            $module = Module::whereIn('id', $moduleIds)
                ->whereNotNull('logo_path')
                ->orderBy('id')
                ->first();

            if (!empty($module?->logo_path)) {
                return $module->logo_path;
            }
        }

        // If no quiz-linked modules are available, try any module in the course.
        $courseModuleLogo = Module::where('course_id', $course->id)
            ->whereNotNull('logo_path')
            ->orderBy('id')
            ->value('logo_path');

        if (!empty($courseModuleLogo)) {
            return $courseModuleLogo;
        }

        // Compatibility fallback for existing product_logos mappings.
        foreach ($moduleIds as $moduleId) {
            $moduleLogo = ProductLogo::where('module_id', $moduleId)
                ->orderByDesc('id')
                ->first();

            if ($moduleLogo?->file_path) {
                return $moduleLogo->file_path;
            }
        }

        if (!empty($moduleIds)) {
            $lessonLogo = ProductLogo::whereIn('lesson_id', function ($query) use ($moduleIds) {
                $query->select('id')
                    ->from('lessons')
                    ->whereIn('module_id', $moduleIds);
            })->orderByDesc('id')->first();

            if ($lessonLogo?->file_path) {
                return $lessonLogo->file_path;
            }
        }

        return $course->logo_path;
    }
}
