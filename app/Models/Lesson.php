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
        'text_content',
        'content_path',
        'duration',
        'file_size',
        'status',
        'order',
    ];

    protected $appends = ['content_url', 'file_type'];

    public function getContentUrlAttribute(): ?string
    {
        if (!$this->content_path) {
            return null;
        }

        // If content_path already contains an absolute URL (e.g., YouTube embed URL), return it directly
        if (preg_match('#^https?://#i', $this->content_path)) {
            return $this->content_path;
        }

        return url('/storage/' . $this->content_path);
    }

    public function getFileTypeAttribute(): ?string
    {
        if (!$this->content_path) {
            return null;
        }

        // If it's an external URL and the lesson type is Video, treat as video
        if (preg_match('#^https?://#i', $this->content_path)) {
            if ($this->type === 'Video') return 'video';
            return 'file';
        }

        $extension = strtolower(pathinfo($this->content_path, PATHINFO_EXTENSION));

        $types = [
            'pdf'  => 'pdf',
            'doc'  => 'document',
            'docx' => 'document',
            'ppt'  => 'presentation',
            'pptx' => 'presentation',
            'mp4'  => 'video',
            'mp3'  => 'audio',
            'txt'  => 'text',
        ];

        return $types[$extension] ?? 'file';
    }

    public function module()
    {
        return $this->belongsTo(Module::class);
    }

    /**
     * Get the custom lesson this lesson is synced from (if any).
     */
    public function customLesson()
    {
        return $this->belongsTo(CustomLesson::class, 'custom_lesson_id');
    }
}
