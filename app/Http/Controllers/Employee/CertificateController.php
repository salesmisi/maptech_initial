<?php

namespace App\Http\Controllers\Employee;

use App\Http\Controllers\Controller;
use App\Models\Certificate;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class CertificateController extends Controller
{
    /**
     * List all certificates for the authenticated employee.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        $certificates = Certificate::where('user_id', $user->id)
            ->with('course:id,title,department,subdepartment_id')
            ->orderByDesc('completed_at')
            ->get()
            ->map(function (Certificate $cert) use ($user) {
                return [
                    'id'               => $cert->id,
                    'course_id'        => $cert->course_id,
                    'title'            => $cert->course?->title ?? 'Unknown Course',
                    'department'       => $cert->course?->department,
                    'certificate_code' => $cert->certificate_code,
                    'completed_at'     => $cert->completed_at->toISOString(),
                    'completed_date'   => $cert->completed_at->format('M d, Y'),
                    'score'            => $cert->score,
                    'user_name'        => $user->fullname,
                    'logo_url'         => $cert->logo_path ? asset('storage/' . $cert->logo_path) : null,
                ];
            });

        return response()->json($certificates);
    }

    /**
     * Upload a logo for a certificate.
     */
    public function uploadLogo(Request $request, $id)
    {
        $user = $request->user();
        $cert = Certificate::where('user_id', $user->id)->findOrFail($id);

        $request->validate([
            'logo' => 'required|image|mimes:png,jpg,jpeg,svg|max:2048',
        ]);

        // Delete old logo if exists
        if ($cert->logo_path) {
            Storage::disk('public')->delete($cert->logo_path);
        }

        $path = $request->file('logo')->store('certificate-logos', 'public');
        $cert->update(['logo_path' => $path]);

        return response()->json([
            'message' => 'Logo uploaded successfully',
            'logo_url' => asset('storage/' . $path),
        ]);
    }

    /**
     * Remove the logo from a certificate.
     */
    public function removeLogo(Request $request, $id)
    {
        $user = $request->user();
        $cert = Certificate::where('user_id', $user->id)->findOrFail($id);

        if ($cert->logo_path) {
            Storage::disk('public')->delete($cert->logo_path);
            $cert->update(['logo_path' => null]);
        }

        return response()->json(['message' => 'Logo removed']);
    }
}
