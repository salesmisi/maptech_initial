<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\AuditLogRetentionPolicy;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApplyAuditLogRetentionCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_command_soft_deletes_logs_older_than_cutoff_when_enabled(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);

        AuditLogRetentionPolicy::current()->update([
            'enabled' => true,
            'retention_value' => 7,
            'retention_unit' => 'days',
        ]);

        $oldLog = AuditLog::create([
            'user_id' => $admin->id,
            'action' => 'old action',
            'ip_address' => '127.0.0.1',
            'created_at' => now()->subDays(10),
        ]);

        $recentLog = AuditLog::create([
            'user_id' => $admin->id,
            'action' => 'recent action',
            'ip_address' => '127.0.0.1',
            'created_at' => now()->subDays(2),
        ]);

        $this->artisan('audit-logs:apply-retention')
            ->expectsOutputToContain('Soft deleted')
            ->assertExitCode(0);

        $this->assertNotNull($oldLog->fresh()->deleted_at);
        $this->assertNull($recentLog->fresh()->deleted_at);
    }

    public function test_command_does_nothing_when_policy_disabled(): void
    {
        $admin = User::factory()->create(['role' => 'admin']);

        AuditLogRetentionPolicy::current()->update([
            'enabled' => false,
            'retention_value' => 7,
            'retention_unit' => 'days',
        ]);

        $log = AuditLog::create([
            'user_id' => $admin->id,
            'action' => 'should stay',
            'ip_address' => '127.0.0.1',
            'created_at' => now()->subDays(30),
        ]);

        $this->artisan('audit-logs:apply-retention')
            ->expectsOutput('Audit log retention is disabled.')
            ->assertExitCode(0);

        $this->assertNull($log->fresh()->deleted_at);
    }
}
