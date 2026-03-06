<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\CourseEnrollment;
use Carbon\Carbon;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    /**
     * Return live analytics metrics for the admin reports dashboard.
     */
    public function analytics(Request $request)
    {
        $months = (int) $request->query('months', 6);
        $months = max(1, min($months, 12));

        $currentMonth = Carbon::now()->startOfMonth();
        $startMonth = $currentMonth->copy()->subMonths($months - 1);

        $monthKeys = [];
        $monthlyTrends = [];

        for ($i = 0; $i < $months; $i++) {
            $month = $startMonth->copy()->addMonths($i);
            $key = $month->format('Y-m');
            $monthKeys[] = $key;
            $monthlyTrends[$key] = [
                'name' => $month->format('M'),
                'enrollments' => 0,
                'completions' => 0,
            ];
        }

        $enrollments = CourseEnrollment::where(function ($query) use ($startMonth) {
            $query->where('enrolled_at', '>=', $startMonth)
                ->orWhere('completed_at', '>=', $startMonth);
        })->get(['enrolled_at', 'completed_at', 'status', 'progress']);

        foreach ($enrollments as $enrollment) {
            if ($enrollment->enrolled_at) {
                $enrolledKey = Carbon::parse($enrollment->enrolled_at)->format('Y-m');
                if (isset($monthlyTrends[$enrolledKey])) {
                    $monthlyTrends[$enrolledKey]['enrollments']++;
                }
            }

            $completedAt = $enrollment->completed_at;
            if (!$completedAt && $enrollment->status === 'Completed') {
                $completedAt = $enrollment->enrolled_at;
            }

            if ($completedAt) {
                $completedKey = Carbon::parse($completedAt)->format('Y-m');
                if (isset($monthlyTrends[$completedKey])) {
                    $monthlyTrends[$completedKey]['completions']++;
                }
            }
        }

        $totalEnrollments = CourseEnrollment::count();

        $completedCount = CourseEnrollment::where(function ($query) {
            $query->where('status', 'Completed')
                ->orWhere('progress', '>=', 100)
                ->orWhereNotNull('completed_at');
        })->count();

        $inProgressCount = CourseEnrollment::where('status', 'Active')
            ->where('progress', '>', 0)
            ->where('progress', '<', 100)
            ->count();

        $notStartedCount = max(0, $totalEnrollments - $completedCount - $inProgressCount);

        $coursePopularity = Course::withCount('enrollments')
            ->orderByDesc('enrollments_count')
            ->limit(5)
            ->get(['id', 'title'])
            ->map(function ($course) {
                return [
                    'name' => $course->title,
                    'students' => $course->enrollments_count,
                ];
            })
            ->values();

        return response()->json([
            'completion_status' => [
                ['name' => 'Completed', 'value' => $completedCount],
                ['name' => 'In Progress', 'value' => $inProgressCount],
                ['name' => 'Not Started', 'value' => $notStartedCount],
            ],
            'monthly_trends' => array_values($monthlyTrends),
            'course_popularity' => $coursePopularity,
            'meta' => [
                'months' => $months,
                'updated_at' => now()->toIso8601String(),
            ],
        ]);
    }
}
