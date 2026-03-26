<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Only run on Postgres
        $driver = Schema::getConnection()->getDriverName();
        if ($driver !== 'pgsql') {
            return;
        }

        // Convert time_logs columns to timestamptz
        try {
            DB::statement("ALTER TABLE time_logs ALTER COLUMN time_in TYPE timestamptz USING (time_in AT TIME ZONE 'UTC')");
            DB::statement("ALTER TABLE time_logs ALTER COLUMN time_out TYPE timestamptz USING (time_out AT TIME ZONE 'UTC')");
            DB::statement("ALTER TABLE time_logs ALTER COLUMN created_at TYPE timestamptz USING (created_at AT TIME ZONE 'UTC')");
            DB::statement("ALTER TABLE time_logs ALTER COLUMN updated_at TYPE timestamptz USING (updated_at AT TIME ZONE 'UTC')");
        } catch (\Exception $e) {
            // ignore if columns missing or already converted
        }

        // Convert audit_logs columns to timestamptz
        try {
            DB::statement("ALTER TABLE audit_logs ALTER COLUMN created_at TYPE timestamptz USING (created_at AT TIME ZONE 'UTC')");
            DB::statement("ALTER TABLE audit_logs ALTER COLUMN updated_at TYPE timestamptz USING (updated_at AT TIME ZONE 'UTC')");
        } catch (\Exception $e) {
            // ignore
        }

        // Optionally handle other tables commonly using timestamps
        $tables = ['users', 'courses', 'enrollments'];
        foreach ($tables as $t) {
            try {
                DB::statement("ALTER TABLE {$t} ALTER COLUMN created_at TYPE timestamptz USING (created_at AT TIME ZONE 'UTC')");
                DB::statement("ALTER TABLE {$t} ALTER COLUMN updated_at TYPE timestamptz USING (updated_at AT TIME ZONE 'UTC')");
            } catch (\Exception $e) {
                // ignore missing columns
            }
        }
    }

    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();
        if ($driver !== 'pgsql') {
            return;
        }

        try {
            DB::statement("ALTER TABLE time_logs ALTER COLUMN time_in TYPE timestamp USING (time_in AT TIME ZONE 'UTC')");
            DB::statement("ALTER TABLE time_logs ALTER COLUMN time_out TYPE timestamp USING (time_out AT TIME ZONE 'UTC')");
            DB::statement("ALTER TABLE time_logs ALTER COLUMN created_at TYPE timestamp USING (created_at AT TIME ZONE 'UTC')");
            DB::statement("ALTER TABLE time_logs ALTER COLUMN updated_at TYPE timestamp USING (updated_at AT TIME ZONE 'UTC')");
        } catch (\Exception $e) {
            // ignore
        }

        try {
            DB::statement("ALTER TABLE audit_logs ALTER COLUMN created_at TYPE timestamp USING (created_at AT TIME ZONE 'UTC')");
            DB::statement("ALTER TABLE audit_logs ALTER COLUMN updated_at TYPE timestamp USING (updated_at AT TIME ZONE 'UTC')");
        } catch (\Exception $e) {
            // ignore
        }

        $tables = ['users', 'courses', 'enrollments'];
        foreach ($tables as $t) {
            try {
                DB::statement("ALTER TABLE {$t} ALTER COLUMN created_at TYPE timestamp USING (created_at AT TIME ZONE 'UTC')");
                DB::statement("ALTER TABLE {$t} ALTER COLUMN updated_at TYPE timestamp USING (updated_at AT TIME ZONE 'UTC')");
            } catch (\Exception $e) {
                // ignore
            }
        }
    }
};
