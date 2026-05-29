<?php

namespace App\Console\Commands;

use App\Models\AuditLog;
use App\Models\AuditLogRetentionPolicy;
use Carbon\Carbon;
use Illuminate\Console\Command;

class ApplyAuditLogRetention extends Command
{
    protected $signature = 'audit-logs:apply-retention';

    protected $description = 'Soft delete audit logs older than the configured retention period';

    public function handle(): int
    {
        $policy = AuditLogRetentionPolicy::current();

        if (! $policy->enabled) {
            $this->info('Audit log retention is disabled.');

            return self::SUCCESS;
        }

        $unit = strtolower((string) $policy->retention_unit);
        $value = max(1, (int) $policy->retention_value);
        $now = Carbon::now(config('app.timezone'));

        $cutoff = match ($unit) {
            'weeks' => $now->copy()->subWeeks($value),
            'months' => $now->copy()->subMonths($value),
            'years' => $now->copy()->subYears($value),
            default => $now->copy()->subDays($value),
        };

        $affected = AuditLog::query()
            ->whereNull('deleted_at')
            ->where('created_at', '<', $cutoff)
            ->update(['deleted_at' => $now]);

        $this->info(sprintf(
            'Soft deleted %d audit log(s) older than %d %s.',
            $affected,
            $value,
            $unit
        ));

        return self::SUCCESS;
    }
}
