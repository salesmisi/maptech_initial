<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CustomLesson extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'custom_module_id',
        'title',
        'description',
        'content_type',
        'text_content',
        'content_path',
        'content_url',
        'file_name',
        'file_type',
        'file_size',
        'duration',
        'quiz_id',
        'order',
        'status',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'order' => 'integer',
        'duration' => 'integer',
        'file_size' => 'integer',
    ];

    /**
     * The accessors to append to the model's array form.
     */
    protected $appends = ['content_full_url', 'formatted_duration', 'formatted_file_size'];

    /**
     * Get the full content URL attribute.
     */
    public function getContentFullUrlAttribute(): ?string
    {
        // For links, return the URL directly
        if ($this->content_type === 'link' && $this->content_url) {
            return $this->content_url;
        }

        if (!$this->content_path) {
            return null;
        }

        // If content_path already contains an absolute URL, return it directly
        if (preg_match('#^https?://#i', $this->content_path)) {
            return $this->content_path;
        }

        return url('/storage/' . $this->content_path);
    }

    /**
     * Get formatted duration (e.g., "5:30" or "1:02:15").
     */
    public function getFormattedDurationAttribute(): ?string
    {
        if (!$this->duration) {
            return null;
        }

        $hours = floor($this->duration / 3600);
        $minutes = floor(($this->duration % 3600) / 60);
        $seconds = $this->duration % 60;

        if ($hours > 0) {
            return sprintf('%d:%02d:%02d', $hours, $minutes, $seconds);
        }

        return sprintf('%d:%02d', $minutes, $seconds);
    }

    /**
     * Get formatted file size (e.g., "1.5 MB").
     */
    public function getFormattedFileSizeAttribute(): ?string
    {
        if (!$this->file_size) {
            return null;
        }

        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $bytes = $this->file_size;
        $i = 0;

        while ($bytes >= 1024 && $i < count($units) - 1) {
            $bytes /= 1024;
            $i++;
        }

        return round($bytes, 2) . ' ' . $units[$i];
    }

    /**
     * Get the custom module this lesson belongs to.
     */
    public function customModule(): BelongsTo
    {
        return $this->belongsTo(CustomModule::class);
    }

    /**
     * Get the quiz associated with this lesson (optional).
     */
    public function quiz(): BelongsTo
    {
        return $this->belongsTo(Quiz::class);
    }

    /**
     * Get the course lessons that are synced from this custom lesson.
     */
    public function syncedLessons(): HasMany
    {
        return $this->hasMany(Lesson::class, 'custom_lesson_id');
    }

    /**
     * Scope for published lessons.
     */
    public function scopePublished($query)
    {
        return $query->where('status', 'published');
    }

    /**
     * Scope for filtering by content type.
     */
    public function scopeOfType($query, string $type)
    {
        return $query->where('content_type', $type);
    }
}
