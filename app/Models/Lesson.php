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
        'content_path',
        'order',
    ];

    protected $appends = ['content_url', 'file_type'];

    public function getContentUrlAttribute(): ?string
    {
        if (!$this->content_path) {
            return null;
        }
        return url('/storage/' . $this->content_path);
    }

    public function getFileTypeAttribute(): ?string
    {
        if (!$this->content_path) {
            return null;
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
}
