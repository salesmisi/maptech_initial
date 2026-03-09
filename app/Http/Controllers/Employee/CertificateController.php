<?php

namespace App\Http\Controllers\Employee;

use App\Http\Controllers\Controller;
use App\Models\Certificate;
use Illuminate\Http\Request;

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
                ];
            });

        return response()->json($certificates);
    }
}
