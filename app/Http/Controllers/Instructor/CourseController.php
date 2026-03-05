<?php

namespace App\Http\Controllers\Instructor;

use App\Http\Controllers\Controller;
use App\Models\Course;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Exception;

class CourseController extends Controller
{
    /**
     * Get instructor's own courses (with modules).
     */
    public function index(Request $request)
    {
        $user = $request->user();

        $courses = Course::where('instructor_id', $user->id)
            ->with(['modules'])
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
                'id'   => $user->id,
                'name' => $user->fullname,
                'email' => $user->email,
                'role' => $user->role,
            ],
            'total_courses'  => $courses->count(),
            'active_courses' => $courses->where('status', 'Active')->count(),
            'draft_courses'  => $courses->where('status', 'Draft')->count(),
            'courses'        => $courses,
        ]);
    }

    /**
     * Get a specific own course with modules.
     */
    public function show(Request $request, string $id)
    {
        $user = $request->user();

        $course = Course::where('id', $id)
            ->where('instructor_id', $user->id)
            ->with(['modules'])
            ->first();

        if (!$course) {
            return response()->json(['message' => 'Course not found.'], 404);
        }

        return response()->json($course);
    }

    /**
     * Create a new course.
     */
    public function store(Request $request)
    {
        $user = $request->user();

        try {
            $validated = $request->validate([
                'title'              => 'required|string|max:255',
                'description'        => 'nullable|string',
                'department'         => 'required|string|max:255',
                'status'             => ['nullable', Rule::in(['Active', 'Inactive', 'Draft'])],
                'deadline'           => 'nullable|date',
                'modules'            => 'nullable|array',
                'modules.*.title'    => 'nullable|string|max:255',
                'modules.*.content'  => 'nullable|file|max:102400',
            ]);

            $course = Course::create([
                'title'         => $validated['title'],
                'description'   => $validated['description'] ?? null,
                'department'    => $validated['department'],
                'instructor_id' => $user->id,
                'status'        => $validated['status'] ?? 'Active',
                'deadline'      => $validated['deadline'] ?? null,
            ]);

            if (!empty($validated['modules'])) {
                foreach ($validated['modules'] as $module) {
                    if (isset($module['content']) && $module['content'] instanceof \Illuminate\Http\UploadedFile) {
                        $filePath = $module['content']->store('course-content', 'public');
                        $course->modules()->create([
                            'title'        => $module['title'] ?? 'Untitled Module',
                            'content_path' => $filePath,
                        ]);
                    }
                }
            }

            return response()->json([
                'message' => 'Course created successfully',
                'course'  => $course->load('modules'),
            ], 201);
        } catch (ValidationException $e) {
            return response()->json(['message' => 'Validation failed', 'errors' => $e->errors()], 422);
        } catch (Exception $e) {
            return response()->json(['message' => 'An error occurred: ' . $e->getMessage()], 500);
        }
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

        try {
            $validated = $request->validate([
                'title'             => 'sometimes|string|max:255',
                'description'       => 'nullable|string',
                'department'        => 'sometimes|string|max:255',
                'status'            => ['sometimes', Rule::in(['Active', 'Inactive', 'Draft'])],
                'deadline'          => 'nullable|date',
                'modules'           => 'nullable|array',
                'modules.*.title'   => 'nullable|string|max:255',
                'modules.*.content' => 'nullable|file|max:102400',
            ]);

            $course->update(array_filter($validated, fn ($k) =>
                in_array($k, ['title', 'description', 'department', 'status', 'deadline']),
                ARRAY_FILTER_USE_KEY
            ));

            if (!empty($validated['modules'])) {
                foreach ($validated['modules'] as $module) {
                    if (isset($module['content']) && $module['content'] instanceof \Illuminate\Http\UploadedFile) {
                        $filePath = $module['content']->store('course-content', 'public');
                        $course->modules()->create([
                            'title'        => $module['title'] ?? 'Untitled Module',
                            'content_path' => $filePath,
                        ]);
                    }
                }
            }

            return response()->json([
                'message' => 'Course updated successfully',
                'course'  => $course->load('modules'),
            ]);
        } catch (ValidationException $e) {
            return response()->json(['message' => 'Validation failed', 'errors' => $e->errors()], 422);
        } catch (Exception $e) {
            return response()->json(['message' => 'An error occurred: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Delete own course.
     */
    public function destroy(Request $request, string $id)
    {
        $user = $request->user();

        $course = Course::where('id', $id)
            ->where('instructor_id', $user->id)
            ->firstOrFail();

        $course->delete();

        return response()->json(['message' => 'Course deleted successfully']);
    }

    /**
     * Add a module to an own course.
     */
    public function addModule(Request $request, string $id)
    {
        $user = $request->user();

        $course = Course::where('id', $id)
            ->where('instructor_id', $user->id)
            ->firstOrFail();

        $request->validate([
            'title'   => 'required|string|max:255',
            'content' => 'nullable|file|max:102400',
        ]);

        $data = ['title' => $request->input('title')];

        if ($request->hasFile('content')) {
            $data['content_path'] = $request->file('content')->store('course-content', 'public');
        }

        $module = $course->modules()->create($data);

        return response()->json(['message' => 'Module added successfully', 'module' => $module], 201);
    }

    /**
     * Delete a module from an own course.
     */
    public function deleteModule(Request $request, string $courseId, int $moduleId)
    {
        $user = $request->user();

        $course = Course::where('id', $courseId)
            ->where('instructor_id', $user->id)
            ->firstOrFail();

        $module = $course->modules()->findOrFail($moduleId);
        $module->delete();

        return response()->json(['message' => 'Module deleted successfully']);
    }
}
