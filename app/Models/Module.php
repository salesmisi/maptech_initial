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

        // Always serve module files through the authenticated API endpoint.
        return url('/api/modules/' . $this->id . '/content');
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
}
