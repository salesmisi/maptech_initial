<?php

namespace App\Http\Controllers\Employee;

use App\Http\Controllers\Controller;
use App\Models\Certificate;
use App\Models\User;
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
        $adminSigner = User::query()
            ->where('role', 'admin')
            ->whereNotNull('signature_path')
            ->orderByDesc('updated_at')
            ->first(['id', 'fullname', 'signature_path', 'company_role']);

        $certificates = Certificate::where('user_id', $user->id)
            ->with([
                'course:id,title,department,subdepartment_id,logo_path,instructor_id',
                'course.instructor:id,fullname,signature_path',
            ])
            ->orderByDesc('completed_at')
            ->get()
            ->map(function (Certificate $cert) use ($user, $adminSigner) {
                // Use latest course-level logo first so admin branding updates reflect immediately.
                $logoPath = $cert->course?->logo_path ?? $cert->logo_path;
                // Admin signer (center block on certificate)
                $adminSignaturePath = $adminSigner?->signature_path;
                $adminSignerName    = $adminSigner?->fullname;
                $adminSignerTitle   = $adminSigner ? ($adminSigner->company_role ?: 'Administrator') : null;
                $adminSignatureUrl  = null;
                if (!empty($adminSignaturePath)) {
                    $adminSignatureUrl = preg_match('#^https?://#i', $adminSignaturePath)
                        ? $adminSignaturePath
                        : asset('storage/' . ltrim($adminSignaturePath, '/'));
                }

                // Instructor signer (right block on certificate)
                $instructorSignaturePath = $cert->course?->instructor?->signature_path;
                $instructorName          = $cert->course?->instructor?->fullname ?? 'Instructor';
                $instructorSignatureUrl  = null;
                if (!empty($instructorSignaturePath)) {
                    $instructorSignatureUrl = preg_match('#^https?://#i', $instructorSignaturePath)
                        ? $instructorSignaturePath
                        : asset('storage/' . ltrim($instructorSignaturePath, '/'));
                }

                // Legacy fallback fields (keep backward compat)
                $signaturePath = $adminSignaturePath ?: $instructorSignaturePath;
                $signerName    = $adminSignerName ?: $instructorName;
                $signerTitle   = $adminSignerTitle ?? 'Instructor';
                $signatureUrl  = $adminSignatureUrl ?: $instructorSignatureUrl;

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
                    'logo_url'         => $logoPath ? asset('storage/' . ltrim($logoPath, '/')) : null,
                    'instructor_name'            => $instructorName,
                    'instructor_signature_url'  => $instructorSignatureUrl,
                    'signer_name'               => $adminSignerName,
                    'signer_title'              => $adminSignerTitle,
                    'admin_signature_url'       => $adminSignatureUrl,
                    'has_course_logo'  => (bool) $cert->course?->logo_path,
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
