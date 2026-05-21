<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\LessonFeedback;
use App\Models\Department;
use App\Models\QuizFeedback;
use Illuminate\Http\Request;

class FeedbackController extends Controller
{
    /**
     * List lesson feedbacks. Filter by department (name or id), course_id, or lesson_id.
     */
    public function index(Request $request)
    {
        $type = $request->get('type', 'lesson');
        $archived = filter_var($request->query('archived'), FILTER_VALIDATE_BOOLEAN);

        if ($type === 'quiz') {
            $query = QuizFeedback::with(['user:id,fullname,department,role', 'quiz.module.course:id,title,department'])
                ->orderByDesc('created_at');

            if ($archived) {
                $query->whereNotNull('archived_at');
            } else {
                $query->whereNull('archived_at');
            }

            if ($request->has('department_id')) {
                $dept = Department::find($request->department_id);
                if ($dept) {
                    $departmentName = $dept->name;
                    $query->whereHas('quiz.module.course', function ($q) use ($departmentName) {
                        $q->where('department', $departmentName);
                    });
                }
            } elseif ($request->has('department')) {
                $departmentName = $request->department;
                $query->whereHas('quiz.module.course', function ($q) use ($departmentName) {
                    $q->where('department', $departmentName);
                });
            }

            if ($request->has('course_id')) {
                $query->whereHas('quiz.module', function ($q) use ($request) {
                    $q->where('course_id', $request->course_id);
                });
            }

            if ($request->has('quiz_id')) {
                $query->where('quiz_id', $request->quiz_id);
            }

            $perPage = (int) ($request->get('per_page', 50));
            $perPage = max(10, min(200, $perPage));

            $page = $query->paginate($perPage);

            $result = $page->through(function ($fb) {
                return [
                    'type' => 'quiz',
                    'id' => $fb->id,
                    'user' => [
                        'id' => $fb->user?->id,
                        'name' => $fb->user?->fullname,
                        'department' => $fb->user?->department,
                    ],
                    'lesson' => [
                        'id' => $fb->quiz?->id,
                        'title' => $fb->quiz?->title,
                        'module' => $fb->quiz?->module?->title ?? null,
                        'course' => $fb->quiz?->module?->course?->title ?? null,
                        'course_department' => $fb->quiz?->module?->course?->department ?? null,
                    ],
                    'rating' => $fb->rating,
                    'comment' => $fb->comment,
                    'created_at' => $fb->created_at?->toISOString(),
                    'archived' => (bool) $fb->archived_at,
                ];
            });

            return response()->json($result);
        }
        $departmentName = null;

        if ($request->has('department_id')) {
            $dept = Department::find($request->department_id);
            if ($dept) $departmentName = $dept->name;
        } elseif ($request->has('department')) {
            $departmentName = $request->department;
        }

        $query = LessonFeedback::with(['user:id,fullname,department,role', 'lesson.module.course:id,title,department'])
            ->orderByDesc('created_at');

        if ($archived) {
            $query->whereNotNull('archived_at');
        } else {
            $query->whereNull('archived_at');
        }

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
                'type' => 'lesson',
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
                'archived' => (bool) $fb->archived_at,
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
        $type = $request->input('type', 'lesson');
        if (empty($ids)) {
            return response()->json(['message' => 'No ids provided'], 400);
        }
        if ($type === 'quiz') {
            \App\Models\QuizFeedback::whereIn('id', $ids)->delete();
        } else {
            LessonFeedback::whereIn('id', $ids)->delete();
        }
        return response()->json(['message' => 'Deleted', 'count' => count($ids)]);
    }

    /**
     * Archive or restore a feedback entry.
     */
    public function archive(Request $request, $id)
    {
        $request->validate([
            'archived' => 'nullable|boolean',
            'type' => 'nullable|in:lesson,quiz',
        ]);

        $archived = filter_var($request->input('archived', true), FILTER_VALIDATE_BOOLEAN);
        $type = $request->input('type');

        if ($type === 'quiz') {
            $fb = QuizFeedback::findOrFail($id);
        } elseif ($type === 'lesson') {
            $fb = LessonFeedback::findOrFail($id);
        } else {
            $fb = LessonFeedback::find($id);
            if (!$fb) {
                $fb = QuizFeedback::findOrFail($id);
            }
        }

        $fb->archived_at = $archived ? now() : null;
        $fb->save();

        return response()->json([
            'id' => $fb->id,
            'archived' => (bool) $fb->archived_at,
            'archived_at' => $fb->archived_at?->toISOString(),
        ]);
    }
}
