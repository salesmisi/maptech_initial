<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use App\Models\Certificate;
use App\Models\Enrollment;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('certificates:backfill-logo-path {--dry-run : Preview changes without writing to database} {--only-missing : Update only certificates with empty logo_path}', function () {
    $dryRun = (bool) $this->option('dry-run');
    $onlyMissing = (bool) $this->option('only-missing');

    $query = Certificate::query()->orderBy('id');
    if ($onlyMissing) {
        $query->where(function ($q) {
            $q->whereNull('logo_path')->orWhere('logo_path', '');
        });
    }

    $total = (clone $query)->count();
    $this->info("Certificates to scan: {$total}");
    $this->line($dryRun ? 'Mode: DRY RUN (no writes)' : 'Mode: APPLY CHANGES');

    $checked = 0;
    $updated = 0;
    $unchanged = 0;
    $skippedNoLogo = 0;
    $errors = 0;

    $query->chunkById(100, function ($certs) use ($dryRun, &$checked, &$updated, &$unchanged, &$skippedNoLogo, &$errors) {
        foreach ($certs as $cert) {
            /** @var Certificate $cert */
            $checked++;

            try {
                $resolved = Enrollment::resolveCertificateLogoPathForUserCourse((int) $cert->user_id, (string) $cert->course_id);

                if (empty($resolved)) {
                    $skippedNoLogo++;
                    continue;
                }

                if ((string) $cert->logo_path === (string) $resolved) {
                    $unchanged++;
                    continue;
                }

                if (!$dryRun) {
                    $cert->update(['logo_path' => $resolved]);
                }

                $updated++;

                $this->line(sprintf(
                    '#%d user=%d course=%s %s -> %s',
                    $cert->id,
                    $cert->user_id,
                    $cert->course_id,
                    $cert->logo_path ?: 'null',
                    $resolved
                ));
            } catch (\Throwable $e) {
                $errors++;
                $this->error("Certificate #{$cert->id}: {$e->getMessage()}");
            }
        }
    }, 'id');

    $this->newLine();
    $this->info('Backfill summary:');
    $this->line("Checked: {$checked}");
    $this->line("Updated: {$updated}" . ($dryRun ? ' (simulated)' : ''));
    $this->line("Unchanged: {$unchanged}");
    $this->line("Skipped (no resolved logo): {$skippedNoLogo}");
    $this->line("Errors: {$errors}");
})->purpose('Backfill certificate logo_path from completion-aware module/lesson logo mappings');
