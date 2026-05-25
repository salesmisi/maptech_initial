<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLogRetentionPolicy;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

class AuditLogRetentionPolicyController extends Controller
{
    public function show(): JsonResponse
    {
        if (! Schema::hasTable('audit_log_retention_policies')) {
            return response()->json([
                'enabled' => false,
                'retention_value' => 365,
                'retention_unit' => 'days',
                'configured' => false,
                'message' => 'Retention policy has not been configured yet.',
            ]);
        }

        $policy = AuditLogRetentionPolicy::current();

        return response()->json([
            'enabled' => $policy->enabled,
            'retention_value' => $policy->retention_value,
            'retention_unit' => $policy->retention_unit,
            'configured' => true,
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        if (! Schema::hasTable('audit_log_retention_policies')) {
            return response()->json([
                'message' => 'Retention policy storage is not available yet. Please run the database migration first.',
            ], 503);
        }

        $validated = $request->validate([
            'enabled' => 'required|boolean',
            'retention_value' => 'required|integer|min:1|max:3650',
            'retention_unit' => 'required|in:days,weeks,months,years',
        ]);

        $policy = AuditLogRetentionPolicy::current();
        $policy->update($validated);

        return response()->json([
            'message' => 'Audit log retention policy updated successfully.',
            'enabled' => $policy->enabled,
            'retention_value' => $policy->retention_value,
            'retention_unit' => $policy->retention_unit,
        ]);
    }
}
