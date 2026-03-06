<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Module extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'title',
        'content_path',
        'course_id',
        'order',
        'pre_assessment',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'pre_assessment' => 'array',
    ];

    /**
     * The accessors to append to the model's array form.
     */
    protected $appends = ['content_url', 'file_type'];

    /**
     * Get the content URL attribute.
     */
    public function getContentUrlAttribute(): ?string
    {
        if (!$this->content_path) {
            return null;
        }

        // If content_path is already a full URL (http/https), return as-is
        if (preg_match('#^https?://#i', $this->content_path)) {
            return $this->content_path;
        }

        // Use relative URL so browser keeps same host/session cookies.
        return '/api/modules/' . $this->id . '/content';
    }

    /**
     * Get the file type based on extension.
     */
    public function getFileTypeAttribute(): ?string
    {
        if (!$this->content_path) {
            return null;
        }

        $extension = strtolower(pathinfo($this->content_path, PATHINFO_EXTENSION));

        $types = [
            'pdf' => 'pdf',
            'doc' => 'document',
            'docx' => 'document',
            'ppt' => 'presentation',
            'pptx' => 'presentation',
            'mp4' => 'video',
            'mp3' => 'audio',
            'txt' => 'text',
        ];

        return $types[$extension] ?? 'file';
    }

    /**
     * Get the course that owns the module.
     */
    public function course()
    {
        return $this->belongsTo(Course::class);
    }

    /**
     * Get the lessons for the module.
     */
    public function lessons()
    {
        return $this->hasMany(Lesson::class)->orderBy('order');
    }
}
