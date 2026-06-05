<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Course;
use App\Models\ProductLogo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class ProductLogoManagerController extends Controller
{
    /**
     * List all courses with current assigned product logo.
     */
    public function index(Request $request)
    {
        $query = trim((string) $request->query('q', ''));
        $hasCourseLogoPath = Schema::hasColumn('courses', 'logo_path');
        $hasProductLogosTable = Schema::hasTable('product_logos');
        $hasProductLogosCourseId = $hasProductLogosTable && Schema::hasColumn('product_logos', 'course_id');

        $selectColumns = ['id', 'title', 'department', 'updated_at'];
        if ($hasCourseLogoPath) {
            $selectColumns[] = 'logo_path';
        }

        $courses = Course::query()
            ->select($selectColumns)
            ->when($query !== '', function ($q) use ($query) {
                $q->where(function ($sub) use ($query) {
                    $sub->where('title', 'like', "%{$query}%")
                        ->orWhere('department', 'like', "%{$query}%");
                });
            })
            ->orderBy('title')
            ->get();

        $logoByCourse = collect();
        if ($hasProductLogosCourseId) {
            $logoByCourse = ProductLogo::whereIn('course_id', $courses->pluck('id')->all())
                ->orderByDesc('id')
                ->get()
                ->unique('course_id')
                ->keyBy('course_id');
        }

        return response()->json($courses->map(function (Course $course) use ($logoByCourse, $hasCourseLogoPath) {
            $exists = false;
            $logoUrl = null;
            $logoName = null;

            /** @var ProductLogo|null $savedLogo */
            $savedLogo = $logoByCourse->get($course->id);

            $courseLogoPath = $hasCourseLogoPath ? ($course->logo_path ?? null) : null;
            $effectivePath = $courseLogoPath ?: ($savedLogo?->file_path ?? null);

            if (!empty($effectivePath)) {
                $exists = Storage::disk('public')->exists($effectivePath);
                if ($exists) {
                    $logoUrl = asset('storage/' . ltrim($effectivePath, '/'));
                }

                $logoName = $savedLogo?->name;
                if (empty($logoName)) {
                    $logoName = pathinfo($effectivePath, PATHINFO_FILENAME);
                }
            }

            return [
                'id' => $course->id,
                'title' => $course->title,
                'department' => $course->department,
                'logo_path' => $effectivePath,
                'logo_name' => $logoName,
                'logo_url' => $logoUrl,
                'broken_logo' => !empty($effectivePath) && !$exists,
                'updated_at' => optional($course->updated_at)?->toISOString(),
            ];
        }));
    }

    /**
     * Upload or replace a course product logo.
     */
    public function upload(Request $request, Course $course)
    {
        $hasCourseLogoPath = Schema::hasColumn('courses', 'logo_path');
        $hasProductLogosTable = Schema::hasTable('product_logos');
        $hasProductLogosCourseId = $hasProductLogosTable && Schema::hasColumn('product_logos', 'course_id');

        $validated = $request->validate([
            'logo' => 'required|file|image|mimes:png,jpg,jpeg|max:2048',
            'logo_name' => 'nullable|string|max:255',
        ]);

        $currentPath = null;
        if ($hasCourseLogoPath) {
            $currentPath = $course->logo_path;
        } elseif ($hasProductLogosCourseId) {
            $currentPath = ProductLogo::where('course_id', $course->id)->orderByDesc('id')->value('file_path');
        }

        if (!empty($currentPath)) {
            Storage::disk('public')->delete($currentPath);
        }

        $path = $validated['logo']->store('product_logos', 'public');
        if ($hasCourseLogoPath) {
            $course->logo_path = $path;
            $course->save();
        }

        // Keep logo metadata in product_logos when course_id column is available.
        if ($hasProductLogosCourseId) {
            ProductLogo::where('course_id', $course->id)->delete();

            $logoName = trim((string) ($validated['logo_name'] ?? ''));
            if ($logoName === '') {
                $logoName = pathinfo($validated['logo']->getClientOriginalName(), PATHINFO_FILENAME) ?: ('Course ' . $course->id . ' Logo');
            }

            ProductLogo::create([
                'name' => $logoName,
                'file_path' => $path,
                'course_id' => $course->id,
                'module_id' => null,
                'lesson_id' => null,
            ]);
        }

        return response()->json([
            'message' => 'Product logo saved successfully.',
            'course_id' => $course->id,
            'logo_name' => $hasProductLogosCourseId
                ? ProductLogo::where('course_id', $course->id)->orderByDesc('id')->value('name')
                : pathinfo($path, PATHINFO_FILENAME),
            'logo_path' => $path,
            'logo_url' => asset('storage/' . ltrim($path, '/')),
        ]);
    }

    /**
     * Update logo name for an existing course logo.
     */
    public function updateName(Request $request, Course $course)
    {
        $hasCourseLogoPath = Schema::hasColumn('courses', 'logo_path');
        $hasProductLogosTable = Schema::hasTable('product_logos');
        $hasProductLogosCourseId = $hasProductLogosTable && Schema::hasColumn('product_logos', 'course_id');

        $validated = $request->validate([
            'logo_name' => 'required|string|max:255',
        ]);

        $path = $hasCourseLogoPath
            ? ($course->logo_path ?? null)
            : ($hasProductLogosCourseId ? ProductLogo::where('course_id', $course->id)->orderByDesc('id')->value('file_path') : null);

        if (empty($path)) {
            return response()->json([
                'message' => 'No uploaded logo found for this course. Upload a logo first.',
            ], 422);
        }

        if (!$hasProductLogosCourseId) {
            return response()->json([
                'message' => 'Logo name editing is not available because product_logos.course_id is missing.',
            ], 422);
        }

        ProductLogo::where('course_id', $course->id)->delete();
        ProductLogo::create([
            'name' => trim($validated['logo_name']),
            'file_path' => $path,
            'course_id' => $course->id,
            'module_id' => null,
            'lesson_id' => null,
        ]);

        return response()->json([
            'message' => 'Logo name updated successfully.',
            'course_id' => $course->id,
            'logo_name' => trim($validated['logo_name']),
        ]);
    }

    /**
     * Delete a course product logo.
     */
    public function destroy(Course $course)
    {
        $hasCourseLogoPath = Schema::hasColumn('courses', 'logo_path');
        $hasProductLogosTable = Schema::hasTable('product_logos');
        $hasProductLogosCourseId = $hasProductLogosTable && Schema::hasColumn('product_logos', 'course_id');
        $currentPath = $hasCourseLogoPath
            ? ($course->logo_path ?? null)
            : ($hasProductLogosCourseId ? ProductLogo::where('course_id', $course->id)->orderByDesc('id')->value('file_path') : null);

        if (!empty($currentPath)) {
            Storage::disk('public')->delete($currentPath);
        }

        if ($hasCourseLogoPath && !empty($course->logo_path)) {
            $course->logo_path = null;
            $course->save();
        }

        if ($hasProductLogosCourseId) {
            ProductLogo::where('course_id', $course->id)->delete();
        }

        return response()->json([
            'message' => 'Product logo removed successfully.',
        ]);
    }
}
