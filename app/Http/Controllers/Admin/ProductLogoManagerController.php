<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Module;
use App\Models\ProductLogo;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class ProductLogoManagerController extends Controller
{
    /**
     * List all modules with current assigned product logo.
     */
    public function index(Request $request)
    {
        $query = trim((string) $request->query('q', ''));

        $modules = Module::query()
            ->with('course:id,title')
            ->select('id', 'title', 'course_id', 'logo_path', 'updated_at')
            ->when($query !== '', function ($q) use ($query) {
                $q->where(function ($sub) use ($query) {
                    $sub->where('title', 'like', "%{$query}%")
                        ->orWhereHas('course', function ($courseQ) use ($query) {
                            $courseQ->where('title', 'like', "%{$query}%");
                        });
                });
            })
            ->orderBy('title')
            ->get();

        $logoByModule = collect();
        if (Schema::hasTable('product_logos')) {
            $logoByModule = ProductLogo::whereIn('module_id', $modules->pluck('id')->all())
                ->orderByDesc('id')
                ->get()
                ->unique('module_id')
                ->keyBy('module_id');
        }

        return response()->json($modules->map(function (Module $module) use ($logoByModule) {
            $exists = false;
            $logoUrl = null;
            $logoName = null;

            /** @var ProductLogo|null $legacyLogo */
            $legacyLogo = $logoByModule->get($module->id);

            if (!empty($module->logo_path)) {
                $exists = Storage::disk('public')->exists($module->logo_path);
                if ($exists) {
                    $logoUrl = asset('storage/' . ltrim($module->logo_path, '/'));
                }

                $logoName = $legacyLogo?->name;
                if (empty($logoName)) {
                    $logoName = pathinfo($module->logo_path, PATHINFO_FILENAME);
                }
            }

            return [
                'id' => $module->id,
                'title' => $module->title,
                'course_id' => $module->course_id,
                'course_title' => $module->course?->title,
                'logo_path' => $module->logo_path,
                'logo_name' => $logoName,
                'logo_url' => $logoUrl,
                'broken_logo' => !empty($module->logo_path) && !$exists,
                'updated_at' => optional($module->updated_at)?->toISOString(),
            ];
        }));
    }

    /**
     * Upload or replace a module product logo.
     */
    public function upload(Request $request, Module $module)
    {
        $validated = $request->validate([
            'logo' => 'required|file|image|mimes:png,jpg,jpeg|max:2048',
            'logo_name' => 'nullable|string|max:255',
        ]);

        if (!empty($module->logo_path)) {
            Storage::disk('public')->delete($module->logo_path);
        }

        $path = $validated['logo']->store('product_logos', 'public');
        $module->logo_path = $path;
        $module->save();

        // Keep compatibility with existing product_logos table if it is present in the database.
        if (Schema::hasTable('product_logos')) {
            ProductLogo::where('module_id', $module->id)->delete();

            $logoName = trim((string) ($validated['logo_name'] ?? ''));
            if ($logoName === '') {
                $logoName = pathinfo($validated['logo']->getClientOriginalName(), PATHINFO_FILENAME) ?: ('Module ' . $module->id . ' Logo');
            }

            ProductLogo::create([
                'name' => $logoName,
                'file_path' => $path,
                'module_id' => $module->id,
                'lesson_id' => null,
            ]);
        }

        return response()->json([
            'message' => 'Product logo saved successfully.',
            'module_id' => $module->id,
            'logo_name' => Schema::hasTable('product_logos')
                ? ProductLogo::where('module_id', $module->id)->orderByDesc('id')->value('name')
                : pathinfo($path, PATHINFO_FILENAME),
            'logo_path' => $path,
            'logo_url' => asset('storage/' . ltrim($path, '/')),
        ]);
    }

    /**
     * Update logo name for an existing module logo.
     */
    public function updateName(Request $request, Module $module)
    {
        $validated = $request->validate([
            'logo_name' => 'required|string|max:255',
        ]);

        if (empty($module->logo_path)) {
            return response()->json([
                'message' => 'No uploaded logo found for this module. Upload a logo first.',
            ], 422);
        }

        if (!Schema::hasTable('product_logos')) {
            return response()->json([
                'message' => 'Logo name editing is not available because product_logos table is missing.',
            ], 422);
        }

        ProductLogo::where('module_id', $module->id)->delete();
        ProductLogo::create([
            'name' => trim($validated['logo_name']),
            'file_path' => $module->logo_path,
            'module_id' => $module->id,
            'lesson_id' => null,
        ]);

        return response()->json([
            'message' => 'Logo name updated successfully.',
            'module_id' => $module->id,
            'logo_name' => trim($validated['logo_name']),
        ]);
    }

    /**
     * Delete a module product logo.
     */
    public function destroy(Module $module)
    {
        if (!empty($module->logo_path)) {
            Storage::disk('public')->delete($module->logo_path);
            $module->logo_path = null;
            $module->save();
        }

        if (Schema::hasTable('product_logos')) {
            ProductLogo::where('module_id', $module->id)->delete();
        }

        return response()->json([
            'message' => 'Product logo removed successfully.',
        ]);
    }
}
