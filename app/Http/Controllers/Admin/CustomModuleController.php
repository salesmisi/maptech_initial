<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\CustomModule;
use App\Models\CustomLesson;
use App\Models\Course;
use App\Models\Module;
use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;
use Exception;

class CustomModuleController extends Controller
{
    /**
     * Get all custom modules with filtering and search.
     */
    public function index(Request $request)
    {
        $query = CustomModule::with(['creator:id,fullname,email', 'lessons'])
            ->withCount('lessons');

        // Filter by status
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        // Filter by category
        if ($request->filled('category')) {
            $query->where('category', $request->category);
        }

        // Filter by tag
        if ($request->filled('tag')) {
            $query->whereJsonContains('tags', $request->tag);
        }

        // Search by title or description
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('title', 'ilike', "%{$search}%")
                    ->orWhere('description', 'ilike', "%{$search}%");
            });
        }

        $modules = $query->orderBy('order')->orderByDesc('created_at')->get();

        return response()->json($modules);
    }

    /**
     * Get a single custom module with all details.
     */
    public function show(int $id)
    {
        $module = CustomModule::with([
            'creator:id,fullname,email',
            'updater:id,fullname,email',
            'lessons',
            'versions.creator:id,fullname',
        ])->findOrFail($id);

        return response()->json($module);
    }

    /**
     * Create a new custom module.
     */
    public function store(Request $request)
    {
        Log::info('Creating custom module', ['title' => $request->input('title')]);

        try {
            // Parse component_config if it's a JSON string
            if ($request->has('component_config') && is_string($request->input('component_config'))) {
                $decoded = json_decode($request->input('component_config'), true);
                if (json_last_error() === JSON_ERROR_NONE) {
                    $request->merge(['component_config' => $decoded]);
                }
            }

            $validated = $request->validate([
                'title' => 'required|string|max:255',
                'module_type' => ['nullable', Rule::in(['learning', 'ui_component'])],
                'route_path' => 'nullable|string|max:255',
                'icon_name' => 'nullable|string|max:100',
                'component_config' => 'nullable|array',
                'description' => 'nullable|string',
                'category' => 'nullable|string|max:100',
                'tags' => 'nullable|array',
                'tags.*' => 'string|max:50',
                'status' => ['nullable', Rule::in(['draft', 'published', 'unpublished'])],
                'thumbnail' => 'nullable|image|mimes:png,jpg,jpeg,svg,webp|max:2048',
            ]);

            // Handle thumbnail upload
            $thumbnailPath = null;
            if ($request->hasFile('thumbnail')) {
                $thumbnailPath = $request->file('thumbnail')->store('custom-modules/thumbnails', 'public');
            }

            $module = CustomModule::create([
                'title' => $validated['title'],
                'module_type' => $validated['module_type'] ?? 'learning',
                'route_path' => $validated['route_path'] ?? null,
                'icon_name' => $validated['icon_name'] ?? null,
                'component_config' => $validated['component_config'] ?? null,
                'description' => $validated['description'] ?? null,
                'category' => $validated['category'] ?? null,
                'tags' => $validated['tags'] ?? [],
                'thumbnail_path' => $thumbnailPath,
                'status' => $validated['status'] ?? 'draft',
                'created_by' => $request->user()->id,
                'version' => 1,
            ]);

            Log::info('Custom module created', ['id' => $module->id]);

            return response()->json([
                'message' => 'Custom module created successfully',
                'module' => $module->load('creator:id,fullname,email'),
            ], 201);
        } catch (ValidationException $e) {
            Log::error('Validation failed', $e->errors());
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (Exception $e) {
            Log::error('Error creating custom module', ['error' => $e->getMessage()]);
            return response()->json([
                'message' => 'An error occurred while creating the custom module',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update a custom module.
     */
    public function update(Request $request, int $id)
    {
        $module = CustomModule::findOrFail($id);

        Log::info('Updating custom module', ['id' => $id]);

        try {
            // Parse component_config if it's a JSON string
            if ($request->has('component_config') && is_string($request->input('component_config'))) {
                $decoded = json_decode($request->input('component_config'), true);
                if (json_last_error() === JSON_ERROR_NONE) {
                    $request->merge(['component_config' => $decoded]);
                }
            }

            $validated = $request->validate([
                'title' => 'sometimes|string|max:255',
                'module_type' => ['nullable', Rule::in(['learning', 'ui_component'])],
                'route_path' => 'nullable|string|max:255',
                'icon_name' => 'nullable|string|max:100',
                'component_config' => 'nullable|array',
                'description' => 'nullable|string',
                'category' => 'nullable|string|max:100',
                'tags' => 'nullable|array',
                'tags.*' => 'string|max:50',
                'status' => ['sometimes', Rule::in(['draft', 'published', 'unpublished'])],
                'order' => 'nullable|integer|min:0',
                'thumbnail' => 'nullable|image|mimes:png,jpg,jpeg,svg,webp|max:2048',
            ]);

            // Create version snapshot before update
            $changes = [];
            foreach (['title', 'module_type', 'route_path', 'icon_name', 'description', 'category', 'status'] as $field) {
                if (isset($validated[$field]) && $module->$field !== $validated[$field]) {
                    $changes[$field] = [
                        'old' => $module->$field,
                        'new' => $validated[$field],
                    ];
                }
            }

            if (!empty($changes)) {
                $module->createVersionSnapshot($request->user()->id, $changes);
                $validated['version'] = $module->version + 1;
            }

            // Handle thumbnail upload
            if ($request->hasFile('thumbnail')) {
                // Delete old thumbnail
                if ($module->thumbnail_path) {
                    Storage::disk('public')->delete($module->thumbnail_path);
                }
                $validated['thumbnail_path'] = $request->file('thumbnail')->store('custom-modules/thumbnails', 'public');
            }

            $validated['updated_by'] = $request->user()->id;

            $module->update($validated);

            // If status changed to published, sync to course modules
            if (isset($validated['status']) && $validated['status'] === 'published') {
                $module->syncToCourseModules();
            }

            Log::info('Custom module updated', ['id' => $module->id, 'version' => $module->version]);

            return response()->json([
                'message' => 'Custom module updated successfully',
                'module' => $module->fresh(['creator:id,fullname,email', 'updater:id,fullname,email', 'lessons']),
            ]);
        } catch (ValidationException $e) {
            Log::error('Validation failed', $e->errors());
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (Exception $e) {
            Log::error('Error updating custom module', ['error' => $e->getMessage()]);
            return response()->json([
                'message' => 'An error occurred while updating the custom module',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete a custom module.
     */
    public function destroy(int $id)
    {
        $module = CustomModule::findOrFail($id);

        try {
            // Delete thumbnail
            if ($module->thumbnail_path) {
                Storage::disk('public')->delete($module->thumbnail_path);
            }

            // Delete all lesson files
            foreach ($module->lessons as $lesson) {
                if ($lesson->content_path && !preg_match('#^https?://#i', $lesson->content_path)) {
                    Storage::disk('public')->delete($lesson->content_path);
                }
            }

            $module->delete();

            Log::info('Custom module deleted', ['id' => $id]);

            return response()->json([
                'message' => 'Custom module deleted successfully',
            ]);
        } catch (Exception $e) {
            Log::error('Error deleting custom module', ['error' => $e->getMessage()]);
            return response()->json([
                'message' => 'An error occurred while deleting the custom module',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Toggle publish/unpublish status.
     */
    public function togglePublish(Request $request, int $id)
    {
        $module = CustomModule::findOrFail($id);

        $newStatus = $module->status === 'published' ? 'unpublished' : 'published';

        $module->update([
            'status' => $newStatus,
            'updated_by' => $request->user()->id,
        ]);

        // If publishing, sync to course modules
        if ($newStatus === 'published') {
            $module->syncToCourseModules();
        }

        return response()->json([
            'message' => "Module {$newStatus} successfully",
            'module' => $module->fresh(['creator:id,fullname,email', 'lessons']),
        ]);
    }

    /**
     * Reorder modules.
     */
    public function reorder(Request $request)
    {
        $validated = $request->validate([
            'modules' => 'required|array',
            'modules.*.id' => 'required|exists:custom_modules,id',
            'modules.*.order' => 'required|integer|min:0',
        ]);

        DB::transaction(function () use ($validated) {
            foreach ($validated['modules'] as $item) {
                CustomModule::where('id', $item['id'])->update(['order' => $item['order']]);
            }
        });

        return response()->json([
            'message' => 'Modules reordered successfully',
        ]);
    }

    /**
     * Get all categories.
     */
    public function categories()
    {
        $categories = CustomModule::whereNotNull('category')
            ->distinct()
            ->pluck('category')
            ->filter()
            ->values();

        return response()->json($categories);
    }

    /**
     * Get all tags.
     */
    public function tags()
    {
        $tags = CustomModule::whereNotNull('tags')
            ->pluck('tags')
            ->flatten()
            ->unique()
            ->values();

        return response()->json($tags);
    }

    /**
     * Get version history for a module.
     */
    public function versions(int $id)
    {
        $module = CustomModule::findOrFail($id);

        $versions = $module->versions()
            ->with('creator:id,fullname')
            ->get();

        return response()->json($versions);
    }

    /**
     * Push (sync) a custom module to a specific course.
     */
    public function pushToCourse(Request $request, int $id)
    {
        $customModule = CustomModule::with('lessons')->findOrFail($id);

        $validated = $request->validate([
            'course_id' => 'required|exists:courses,id',
        ]);

        $course = Course::findOrFail($validated['course_id']);

        try {
            DB::transaction(function () use ($customModule, $course) {
                // Check if already synced to this course
                $existingModule = $course->modules()
                    ->where('custom_module_id', $customModule->id)
                    ->first();

                if ($existingModule) {
                    // Update existing module
                    $existingModule->update([
                        'title' => $customModule->title,
                        'description' => $customModule->description,
                        'logo_path' => $customModule->thumbnail_path,
                    ]);

                    // Sync lessons
                    $customModule->syncLessonsToCourseModule($existingModule);
                } else {
                    // Create new module in course
                    $maxOrder = $course->modules()->max('order') ?? 0;

                    $newModule = $course->modules()->create([
                        'custom_module_id' => $customModule->id,
                        'title' => $customModule->title,
                        'description' => $customModule->description,
                        'logo_path' => $customModule->thumbnail_path,
                        'order' => $maxOrder + 1,
                    ]);

                    // Create lessons
                    foreach ($customModule->lessons as $customLesson) {
                        $newModule->lessons()->create([
                            'custom_lesson_id' => $customLesson->id,
                            'title' => $customLesson->title,
                            'type' => ucfirst($customLesson->content_type),
                            'text_content' => $customLesson->text_content,
                            'content_path' => $customLesson->content_path ?? $customLesson->content_url,
                            'duration' => $customLesson->duration,
                            'file_size' => $customLesson->file_size,
                            'status' => $customLesson->status === 'published' ? 'Active' : 'Draft',
                            'order' => $customLesson->order,
                        ]);
                    }
                }
            });

            return response()->json([
                'message' => 'Module synced to course successfully',
            ]);
        } catch (Exception $e) {
            Log::error('Error syncing module to course', ['error' => $e->getMessage()]);
            return response()->json([
                'message' => 'An error occurred while syncing the module',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Push (sync) a custom module to multiple courses with notifications.
     */
    public function pushToCourses(Request $request, int $id)
    {
        $customModule = CustomModule::with('lessons')->findOrFail($id);

        $validated = $request->validate([
            'course_ids' => 'required|array|min:1',
            'course_ids.*' => 'exists:courses,id',
        ]);

        // Use ContentSyncService for full sync with notifications
        $syncService = app(\App\Services\ContentSyncService::class);
        $results = $syncService->syncToMultipleCourses(
            $customModule,
            $validated['course_ids'],
            $request->user()
        );

        if ($results['success_count'] === 0) {
            return response()->json([
                'message' => 'Failed to sync module to any course',
                'errors' => $results['errors'],
            ], 500);
        }

        $message = "Module synced to {$results['success_count']} course" . ($results['success_count'] > 1 ? 's' : '') . " successfully";
        if (count($results['errors']) > 0) {
            $message .= " (some errors occurred)";
        }

        return response()->json([
            'message' => $message,
            'success_count' => $results['success_count'],
            'synced_courses' => $results['synced_courses'],
            'errors' => $results['errors'],
        ]);
    }

    /**
     * Get courses that can receive this module.
     */
    public function availableCourses(int $id)
    {
        $customModule = CustomModule::findOrFail($id);

        // Get all courses with info about whether they already have this module
        $courses = Course::with('instructor:id,fullname')
            ->select('id', 'title', 'department', 'instructor_id', 'status')
            ->get()
            ->map(function ($course) use ($customModule) {
                $synced = $course->modules()
                    ->where('custom_module_id', $customModule->id)
                    ->exists();

                return [
                    'id' => $course->id,
                    'title' => $course->title,
                    'department' => $course->department,
                    'instructor' => $course->instructor?->fullname,
                    'status' => $course->status,
                    'is_synced' => $synced,
                ];
            });

        return response()->json($courses);
    }

    /**
     * Get instructors that can receive this module.
     */
    public function availableUsers(int $id)
    {
        $customModule = CustomModule::findOrFail($id);

        // Get all instructors only (employees see modules automatically when published)
        $users = \App\Models\User::where('role', 'instructor')
            ->select('id', 'fullname', 'email', 'role', 'department')
            ->orderBy('fullname')
            ->get()
            ->map(function ($user) use ($customModule) {
                // Check if this user has been specifically pushed this module
                $isPushed = DB::table('custom_module_user_assignments')
                    ->where('custom_module_id', $customModule->id)
                    ->where('user_id', $user->id)
                    ->exists();

                return [
                    'id' => $user->id,
                    'fullname' => $user->fullname,
                    'email' => $user->email,
                    'role' => ucfirst($user->role),
                    'department' => $user->department,
                    'is_pushed' => $isPushed,
                ];
            });

        return response()->json($users);
    }

    /**
     * Push (assign) a custom module to specific users with notifications.
     */
    public function pushToUsers(Request $request, int $id)
    {
        $customModule = CustomModule::with('lessons')->findOrFail($id);

        $validated = $request->validate([
            'user_ids' => 'required|array|min:1',
            'user_ids.*' => 'exists:users,id',
        ]);

        try {
            $successCount = 0;
            $errors = [];

            DB::transaction(function () use ($customModule, $validated, &$successCount, $request) {
                foreach ($validated['user_ids'] as $userId) {
                    // Create or update assignment
                    DB::table('custom_module_user_assignments')->updateOrInsert(
                        [
                            'custom_module_id' => $customModule->id,
                            'user_id' => $userId,
                        ],
                        [
                            'assigned_by' => $request->user()->id,
                            'assigned_at' => now(),
                            'updated_at' => now(),
                        ]
                    );

                    // Create notification for the user
                    Notification::create([
                        'user_id' => $userId,
                        'type' => 'custom_module_assigned',
                        'title' => 'New Learning Module Assigned',
                        'message' => "A new module \"{$customModule->title}\" has been assigned to you.",
                        'data' => [
                            'module_id' => $customModule->id,
                            'module_title' => $customModule->title,
                        ],
                    ]);

                    $successCount++;
                }
            });

            $roleLabel = 'instructor' . ($successCount > 1 ? 's' : '');
            $message = "Module pushed to {$successCount} {$roleLabel} successfully";

            return response()->json([
                'message' => $message,
                'success_count' => $successCount,
                'errors' => $errors,
            ]);
        } catch (Exception $e) {
            Log::error('Error pushing module to instructors', ['error' => $e->getMessage()]);
            return response()->json([
                'message' => 'An error occurred while pushing the module to instructors',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get published UI component modules for sidebar navigation.
     */
    public function uiComponents(Request $request)
    {
        $modules = CustomModule::where('module_type', 'ui_component')
            ->where('status', 'published')
            ->select('id', 'title', 'route_path', 'icon_name', 'component_config', 'order')
            ->orderBy('order')
            ->get();

        return response()->json($modules);
    }
}
