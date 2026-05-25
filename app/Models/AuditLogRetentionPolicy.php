<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditLogRetentionPolicy extends Model
{
    protected $fillable = [
        'enabled',
        'retention_value',
        'retention_unit',
    ];

    protected $casts = [
        'enabled' => 'boolean',
        'retention_value' => 'integer',
    ];

    public static function current(): self
    {
        return static::query()->firstOrCreate(
            ['id' => 1],
            [
                'enabled' => false,
                'retention_value' => 365,
                'retention_unit' => 'days',
            ]
        );
    }
}
