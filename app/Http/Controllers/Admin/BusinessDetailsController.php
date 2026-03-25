<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\BusinessDetail;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class BusinessDetailsController extends Controller
{
    private function normalizeLogoUrl(?string $path): string
    {
        if (! $path) {
            return '/assets/Maptech-Official-Logo.png';
        }

        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://') || str_starts_with($path, '/')) {
            return $path;
        }

        return Storage::url($path);
    }

    private function currentOrDefault(): BusinessDetail
    {
        return BusinessDetail::firstOrCreate(
            ['id' => 1],
            [
                'company_name' => 'Maptech Information Solutions Inc.',
                'logo_path' => '/assets/Maptech-Official-Logo.png',
            ]
        );
    }

    public function show(): JsonResponse
    {
        $details = $this->currentOrDefault();

        return response()->json([
            'company_name' => $details->company_name,
            'logo_url' => $this->normalizeLogoUrl($details->logo_path),
            'logo_path' => $details->logo_path,
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'company_name' => 'required|string|max:255',
            'logo' => 'nullable|image|mimes:png,jpg,jpeg,svg,webp|max:2048',
            'remove_logo' => 'nullable|boolean',
        ]);

        $details = $this->currentOrDefault();

        $newLogoPath = $details->logo_path;

        if ($request->boolean('remove_logo')) {
            if ($details->logo_path && ! str_starts_with($details->logo_path, '/assets/')) {
                Storage::disk('public')->delete($details->logo_path);
            }
            $newLogoPath = '/assets/Maptech-Official-Logo.png';
        }

        if ($request->hasFile('logo')) {
            if ($details->logo_path && ! str_starts_with($details->logo_path, '/assets/')) {
                Storage::disk('public')->delete($details->logo_path);
            }
            $newLogoPath = $request->file('logo')->store('business-logos', 'public');
        }

        $details->update([
            'company_name' => $validated['company_name'],
            'logo_path' => $newLogoPath,
        ]);

        return response()->json([
            'message' => 'Business details updated successfully.',
            'company_name' => $details->company_name,
            'logo_url' => $this->normalizeLogoUrl($details->logo_path),
            'logo_path' => $details->logo_path,
        ]);
    }
}
