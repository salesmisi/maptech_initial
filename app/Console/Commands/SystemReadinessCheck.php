<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class SystemReadinessCheck extends Command
{
    protected $signature = 'system:readiness-check';

    protected $description = 'Validate local environment and service readiness before runtime';

    public function handle(): int
    {
        $checks = [];

        $checks[] = $this->makeCheck(
            'Environment file',
            file_exists(base_path('.env')),
            '.env file is present',
            '.env file is missing'
        );

        $appKey = (string) config('app.key', '');
        $checks[] = $this->makeCheck(
            'Application key',
            trim($appKey) !== '',
            'APP_KEY is configured',
            'APP_KEY is empty'
        );

        $checks[] = $this->makeCheck(
            'Storage writable',
            is_writable(storage_path()),
            'storage directory is writable',
            'storage directory is not writable'
        );

        $checks[] = $this->makeCheck(
            'Cache writable',
            is_writable(storage_path('framework/cache')),
            'storage/framework/cache is writable',
            'storage/framework/cache is not writable'
        );

        $checks[] = $this->makeCheck(
            'Logs writable',
            is_writable(storage_path('logs')),
            'storage/logs is writable',
            'storage/logs is not writable'
        );

        $checks[] = $this->makeCheck(
            'Extension: zip',
            extension_loaded('zip'),
            'zip extension is loaded',
            'zip extension is not loaded'
        );

        $checks[] = $this->makeCheck(
            'Extension: intl',
            extension_loaded('intl'),
            'intl extension is loaded',
            'intl extension is not loaded (some Artisan display features may fail)',
            true
        );

        if (PHP_OS_FAMILY !== 'Windows') {
            $checks[] = $this->makeCheck(
                'Extension: pcntl',
                extension_loaded('pcntl'),
                'pcntl extension is loaded',
                'pcntl extension is not loaded (required for php artisan pail)',
                true
            );
        } else {
            $checks[] = [
                'name' => 'Extension: pcntl',
                'status' => 'WARN',
                'message' => 'pcntl is not available on Windows (composer dev skips pail automatically)',
                'blocking' => false,
            ];
        }

        $dbConnected = false;
        try {
            DB::connection()->getPdo();
            $dbConnected = true;
        } catch (\Throwable $e) {
            $checks[] = [
                'name' => 'Database connection',
                'status' => 'FAIL',
                'message' => 'Cannot connect to database: '.$e->getMessage(),
                'blocking' => true,
            ];
        }

        if ($dbConnected) {
            $checks[] = $this->makeCheck(
                'Database connection',
                true,
                'Database connection is reachable',
                'Database connection is unavailable'
            );

            try {
                $migrationTableExists = DB::getSchemaBuilder()->hasTable('migrations');
                $checks[] = $this->makeCheck(
                    'Migration repository',
                    $migrationTableExists,
                    'migrations table exists',
                    'migrations table does not exist'
                );
            } catch (\Throwable $e) {
                $checks[] = [
                    'name' => 'Migration repository',
                    'status' => 'FAIL',
                    'message' => 'Unable to inspect migrations table: '.$e->getMessage(),
                    'blocking' => true,
                ];
            }
        }

        $rows = [];
        foreach ($checks as $check) {
            $rows[] = [$check['name'], $check['status'], $check['message']];
        }

        $this->table(['Check', 'Status', 'Details'], $rows);

        $failed = array_filter($checks, fn (array $check) => $check['status'] === 'FAIL' && $check['blocking']);
        $warnings = array_filter($checks, fn (array $check) => $check['status'] === 'WARN');

        if (! empty($failed)) {
            $this->error(sprintf('Readiness check failed with %d blocking issue(s).', count($failed)));

            return self::FAILURE;
        }

        if (! empty($warnings)) {
            $this->warn(sprintf('Readiness check passed with %d warning(s).', count($warnings)));

            return self::SUCCESS;
        }

        $this->info('Readiness check passed with no issues.');

        return self::SUCCESS;
    }

    /**
     * @return array{name: string, status: string, message: string, blocking: bool}
     */
    private function makeCheck(string $name, bool $passed, string $passMessage, string $failMessage, bool $warning = false): array
    {
        if ($passed) {
            return [
                'name' => $name,
                'status' => 'PASS',
                'message' => $passMessage,
                'blocking' => false,
            ];
        }

        return [
            'name' => $name,
            'status' => $warning ? 'WARN' : 'FAIL',
            'message' => $failMessage,
            'blocking' => ! $warning,
        ];
    }
}
