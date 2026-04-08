<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomModuleVersion extends Model
{
    /**
     * The table associated with the model.
     */
    protected $table = 'custom_module_versions';

    /**
     * Indicates if the model should be timestamped.
     */
    public $timestamps = false;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'custom_module_id',
        'version_number',
        'title',
        'description',
        'lessons_snapshot',
        'changes',
        'created_by',
        'created_at',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'lessons_snapshot' => 'array',
        'changes' => 'array',
        'version_number' => 'integer',
        'created_at' => 'datetime',
    ];

    /**
     * Get the custom module this version belongs to.
     */
    public function customModule(): BelongsTo
    {
        return $this->belongsTo(CustomModule::class);
    }

    /**
     * Get the user who created this version.
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
