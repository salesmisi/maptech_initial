<?php

namespace App\Support;

use Illuminate\Support\Carbon;

class AuditDate
{
    public static function storageTimezone(): string
    {
        $tz = (string) config('app.timezone', 'UTC');
        return $tz !== '' ? $tz : 'UTC';
    }

    public static function parseStorageDateTime($value): ?Carbon
    {
        if ($value === null || $value === '') {
            return null;
        }

        try {
            if ($value instanceof Carbon) {
                return $value->copy();
            }

            $raw = trim((string) $value);

            if (preg_match('/(?:Z|[+-]\d{2}(?::?\d{2})?)$/i', $raw) === 1) {
                return Carbon::parse($raw);
            }

            return Carbon::parse($raw, self::storageTimezone());
        } catch (\Throwable $e) {
            return null;
        }
    }

    public static function modelStorageDateTime($model, string $field): ?Carbon
    {
        if (!$model) {
            return null;
        }

        $raw = null;
        if (is_object($model) && method_exists($model, 'getRawOriginal')) {
            $raw = $model->getRawOriginal($field);
        }

        if (($raw === null || $raw === '') && is_object($model) && isset($model->{$field})) {
            $raw = $model->{$field};
        }

        return self::parseStorageDateTime($raw);
    }

    public static function modelFieldUtcIso($model, string $field): ?string
    {
        $dt = self::modelStorageDateTime($model, $field);
        return $dt ? $dt->utc()->toIso8601String() : null;
    }
}
