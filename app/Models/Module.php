<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property int $id
 * @property string $title
 * @property string|null $content_path
 * @property string $course_id
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 */
class Module extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'title',
        'description',
        'content_path',
        'logo_path',
        'course_id',
        'order',
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
     * Get the lessons belonging to this module.
     */
    public function lessons()
    {
        return $this->hasMany(Lesson::class)->orderBy('order');
    }

    /**
     * Get the quiz attached to this module (one module → at most one quiz).
     */
    public function quiz()
    {
        return $this->hasOne(Quiz::class);
    }

    /**
     * Users who have this module explicitly unlocked (pivot `module_user`).
     */
    public function users()
    {
        return $this->belongsToMany(User::class, 'module_user')
            ->withPivot('unlocked', 'unlocked_at', 'unlocked_until')
            ->withTimestamps();
    }

    /**
     * Get the custom module this module is synced from (if any).
     */
    public function customModule()
    {
        return $this->belongsTo(CustomModule::class, 'custom_module_id');
    }
}
