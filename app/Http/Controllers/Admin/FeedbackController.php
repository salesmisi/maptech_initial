<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\LessonFeedback;
use App\Models\Department;
use Illuminate\Http\Request;

class FeedbackController extends Controller
{
    /**
     * List lesson feedbacks. Filter by department (name or id), course_id, or lesson_id.
     */
    public function index(Request $request)
    {
        $departmentName = null;

        if ($request->has('department_id')) {
            $dept = Department::find($request->department_id);
            if ($dept) $departmentName = $dept->name;
        } elseif ($request->has('department')) {
            $departmentName = $request->department;
        }

        $query = LessonFeedback::with(['user:id,fullname,department,role', 'lesson.module.course:id,title,department'])
            ->orderByDesc('created_at');

        if ($departmentName) {
            $query->whereHas('lesson.module.course', function ($q) use ($departmentName) {
                $q->where('department', $departmentName);
            });
        }

        if ($request->has('course_id')) {
            $query->whereHas('lesson.module', function ($q) use ($request) {
                $q->where('course_id', $request->course_id);
            });
        }

        if ($request->has('lesson_id')) {
            $query->where('lesson_id', $request->lesson_id);
        }

        $perPage = (int) ($request->get('per_page', 50));
        $perPage = max(10, min(200, $perPage));

        $page = $query->paginate($perPage);

        // Map to a simple structure
        $result = $page->through(function ($fb) {
            return [
                'id' => $fb->id,
                'user' => [
                    'id' => $fb->user?->id,
                    'name' => $fb->user?->fullname,
                    'department' => $fb->user?->department,
                ],
                'lesson' => [
                    'id' => $fb->lesson?->id,
                    'title' => $fb->lesson?->title,
                    'module' => $fb->lesson?->module?->title ?? null,
                    'course' => $fb->lesson?->module?->course?->title ?? null,
                    'course_department' => $fb->lesson?->module?->course?->department ?? null,
                ],
                'rating' => $fb->rating,
                'comment' => $fb->comment,
                'created_at' => $fb->created_at?->toISOString(),
            ];
        });

        return response()->json($result);
    }

    /**
     * Delete a single feedback (admin only)
     */
    public function destroy(Request $request, $id)
    {
        $fb = LessonFeedback::find($id);
        if (!$fb) return response()->json(['message' => 'Not found'], 404);
        $fb->delete();
        return response()->json(['message' => 'Feedback deleted']);
    }

    /**
     * Bulk delete feedback ids passed as JSON { ids: [1,2,3] }
     */
    public function bulkDelete(Request $request)
    {
        $ids = (array) $request->input('ids', []);
        if (empty($ids)) {
            return response()->json(['message' => 'No ids provided'], 400);
        }
        LessonFeedback::whereIn('id', $ids)->delete();
        return response()->json(['message' => 'Deleted', 'count' => count($ids)]);
    }
}
