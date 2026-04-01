<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\BusinessDetail;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class BusinessDetailsController extends Controller
{
    private function normalizeWebsite(?string $website): ?string
    {
        $value = trim((string) $website);
        if ($value === '') {
            return null;
        }

        if (! preg_match('/^https?:\/\//i', $value)) {
            $value = 'https://'.$value;
        }

        return $value;
    }

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
            'email' => $details->email,
            'phone' => $details->phone,
            'mobile_phone' => $details->mobile_phone,
            'country' => $details->country,
            'address' => $details->address,
            'website' => $details->website,
            'vat_reg_tin' => $details->vat_reg_tin,
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'company_name' => 'required|string|max:255',
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:20',
            'mobile_phone' => 'nullable|string|max:20',
            'country' => 'nullable|string|max:100',
            'address' => 'nullable|string|max:500',
            'website' => 'nullable|string|max:255',
            'vat_reg_tin' => 'nullable|string|max:100',
            'logo' => 'nullable|image|mimes:png,jpg,jpeg,svg,webp|max:2048',
            'remove_logo' => 'nullable|boolean',
        ]);

        $website = $this->normalizeWebsite($validated['website'] ?? null);
        if ($website !== null && ! filter_var($website, FILTER_VALIDATE_URL)) {
            return response()->json([
                'message' => 'Validation failed.',
                'errors' => [
                    'website' => ['Please enter a valid website URL.'],
                ],
            ], 422);
        }

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
            'email' => $validated['email'] ?? null,
            'phone' => $validated['phone'] ?? null,
            'mobile_phone' => $validated['mobile_phone'] ?? null,
            'country' => $validated['country'] ?? null,
            'address' => $validated['address'] ?? null,
            'website' => $website,
            'vat_reg_tin' => $validated['vat_reg_tin'] ?? null,
            'logo_path' => $newLogoPath,
        ]);

        return response()->json([
            'message' => 'Business details updated successfully.',
            'company_name' => $details->company_name,
            'logo_url' => $this->normalizeLogoUrl($details->logo_path),
            'logo_path' => $details->logo_path,
            'email' => $details->email,
            'phone' => $details->phone,
            'mobile_phone' => $details->mobile_phone,
            'country' => $details->country,
            'address' => $details->address,
            'website' => $details->website,
            'vat_reg_tin' => $details->vat_reg_tin,
        ]);
    }
}
