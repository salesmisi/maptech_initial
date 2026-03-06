<?php

namespace App\Http\Controllers\Instructor;

use App\Http\Controllers\Controller;
use App\Models\Course;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CourseController extends Controller
{
    /**
     * Get instructor's courses.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        $courses = Course::where('instructor_id', $user->id)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($courses);
    }

    /**
     * Get instructor dashboard.
     */
    public function dashboard(Request $request)
    {
        $user = $request->user();

        $courses = Course::where('instructor_id', $user->id)->get();

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->fullName ?? $user->name,
                'email' => $user->email,
                'role' => $user->role,
            ],
            'total_courses' => $courses->count(),
            'active_courses' => $courses->where('status', 'Active')->count(),
            'draft_courses' => $courses->where('status', 'Draft')->count(),
            'courses' => $courses,
        ]);
    }

    /**
     * Update own course.
     */
    public function update(Request $request, string $id)
    {
        $user = $request->user();

        $course = Course::where('id', $id)
            ->where('instructor_id', $user->id)
            ->firstOrFail();

        $validated = $request->validate([
            'title' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'status' => ['sometimes', Rule::in(['Active', 'Inactive', 'Draft'])],
        ]);

        $course->update($validated);

        return response()->json([
            'message' => 'Course updated successfully',
            'course' => $course
        ]);
    }

    /**
     * Create a new course.
     */
    public function store(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string',
            'department' => 'required|string|max:255',
            'status' => ['required', Rule::in(['Active', 'Inactive', 'Draft'])],
            'modules' => 'nullable|array',
            'modules.*.title' => 'required_with:modules|string|max:255',
            'modules.*.content' => 'required_with:modules|file',
        ]);

        $course = Course::create([
            'title' => $validated['title'],
            'description' => $validated['description'] ?? null,
            'department' => $validated['department'],
            'instructor_id' => $user->id,
            'status' => $validated['status'],
        ]);

        // Handle modules and content upload
        if (!empty($validated['modules'])) {
            foreach ($validated['modules'] as $module) {
                $filePath = $module['content']->store('course-content', 'public');
                $course->modules()->create([
                    'title' => $module['title'],
                    'content_path' => $filePath,
                ]);
            }
        }

        return response()->json([
            'message' => 'Course created successfully',
            'course' => $course->load('modules')
        ]);
    }
}
