<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Lesson extends Model
{
    use HasFactory;

    protected $fillable = [
        'module_id',
        'title',
        'type',
        'content_path',
        'text_content',
        'duration',
        'file_size',
        'status',
        'order',
    ];

    protected $appends = ['content_url'];

    /**
     * Get the content URL for file-based lessons.
     */
    public function getContentUrlAttribute(): ?string
    {
        if (!$this->content_path) {
            return null;
        }
        if (preg_match('#^https?://#i', $this->content_path)) {
            return $this->content_path;
        }
        return url('/storage/' . $this->content_path);
    }

    /**
     * Get the module that owns the lesson.
     */
    public function module()
    {
        return $this->belongsTo(Module::class);
    }
}
