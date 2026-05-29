<?php

namespace Tests\Feature;

use App\Models\AuditLogRetentionPolicy;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuditLogRetentionPolicyTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_get_default_retention_policy(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/admin/audit-log-retention-policy');

        $response->assertOk()->assertJson([
            'enabled' => false,
            'retention_value' => 365,
            'retention_unit' => 'days',
            'configured' => true,
        ]);
    }

    public function test_show_returns_fallback_when_retention_table_missing(): void
    {
        Schema::dropIfExists('audit_log_retention_policies');

        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/admin/audit-log-retention-policy');

        $response->assertOk()->assertJson([
            'enabled' => false,
            'retention_value' => 365,
            'retention_unit' => 'days',
            'configured' => false,
        ]);
    }

    public function test_admin_can_update_retention_policy(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);
        Sanctum::actingAs($admin);

        $payload = [
            'enabled' => true,
            'retention_value' => 30,
            'retention_unit' => 'days',
        ];

        $response = $this->putJson('/api/admin/audit-log-retention-policy', $payload);

        $response->assertOk()->assertJson([
            'message' => 'Audit log retention policy updated successfully.',
            'enabled' => true,
            'retention_value' => 30,
            'retention_unit' => 'days',
        ]);

        $this->assertDatabaseHas('audit_log_retention_policies', [
            'id' => 1,
            'enabled' => 1,
            'retention_value' => 30,
            'retention_unit' => 'days',
        ]);

        $this->assertTrue(AuditLogRetentionPolicy::current()->enabled);
    }
}
