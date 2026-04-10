<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class AuditLog extends Model
{
    use SoftDeletes;

    public $timestamps = false;

    // Keep offset when persisting dates so timestamptz stores the correct instant.
    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $fillable = [
        'user_id',
        'action',
        'ip_address',
        'session_key',
        'created_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
