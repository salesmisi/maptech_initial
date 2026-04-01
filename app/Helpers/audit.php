<?php

use Illuminate\Support\Carbon;

if (!function_exists('maptech_audit_storage_timezone')) {
    function maptech_audit_storage_timezone(): string
    {
        // Use the app timezone — this matches how Carbon::now() stores timestamps.
        // Locally (Asia/Manila) and on Railway (should also be Asia/Manila via APP_TIMEZONE).
        $tz = (string) config('app.timezone', 'UTC');
        return $tz !== '' ? $tz : 'UTC';
    }
}

if (!function_exists('maptech_parse_storage_datetime')) {
    function maptech_parse_storage_datetime($value): ?Carbon
    {
        if ($value === null || $value === '') {
            return null;
        }

        try {
            if ($value instanceof Carbon) {
                return $value->copy();
            }

            return Carbon::parse((string) $value, maptech_audit_storage_timezone());
        } catch (\Throwable $e) {
            return null;
        }
    }
}

if (!function_exists('maptech_model_storage_datetime')) {
    function maptech_model_storage_datetime($model, string $field): ?Carbon
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

        return maptech_parse_storage_datetime($raw);
    }
}

if (!function_exists('maptech_model_field_utc_iso')) {
    function maptech_model_field_utc_iso($model, string $field): ?string
    {
        $dt = maptech_model_storage_datetime($model, $field);
        return $dt ? $dt->utc()->toIso8601String() : null;
    }
}
