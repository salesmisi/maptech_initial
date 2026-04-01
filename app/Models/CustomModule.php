<?php

namespace App\Models;

use App\Events\CustomModuleUpdated;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CustomModule extends Model
{
    use HasFactory;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'title',
        'module_type',
        'route_path',
        'icon_name',
        'component_config',
        'description',
        'category',
        'tags',
        'thumbnail_path',
        'status',
        'order',
        'created_by',
        'updated_by',
        'version',
    ];

    /**
     * The attributes that should be cast.
     */
    protected $casts = [
        'tags' => 'array',
        'component_config' => 'array',
        'order' => 'integer',
        'version' => 'integer',
    ];

    /**
     * The accessors to append to the model's array form.
     */
    protected $appends = ['thumbnail_url', 'lessons_count'];

    /**
     * Boot the model.
     */
    protected static function boot()
    {
        parent::boot();

        static::updated(function (CustomModule $module) {
            // Fire event to sync changes to linked course modules
            if ($module->status === 'published') {
                event(new CustomModuleUpdated($module));
            }
        });
    }

    /**
     * Get the thumbnail URL attribute.
     */
    public function getThumbnailUrlAttribute(): ?string
    {
        if (!$this->thumbnail_path) {
            return null;
        }

        if (preg_match('#^https?://#i', $this->thumbnail_path)) {
            return $this->thumbnail_path;
        }

        return url('/storage/' . $this->thumbnail_path);
    }

    /**
     * Get the lessons count attribute.
     */
    public function getLessonsCountAttribute(): int
    {
        return $this->lessons()->count();
    }

    /**
     * Get the lessons belonging to this custom module.
     */
    public function lessons(): HasMany
    {
        return $this->hasMany(CustomLesson::class)->orderBy('order');
    }

    /**
     * Get the user who created this module.
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get the user who last updated this module.
     */
    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * Get the version history for this module.
     */
    public function versions(): HasMany
    {
        return $this->hasMany(CustomModuleVersion::class)->orderByDesc('version_number');
    }

    /**
     * Get the course modules that are synced from this custom module.
     */
    public function syncedModules(): HasMany
    {
        return $this->hasMany(Module::class, 'custom_module_id');
    }

    /**
     * Scope for published modules.
     */
    public function scopePublished($query)
    {
        return $query->where('status', 'published');
    }

    /**
     * Scope for filtering by category.
     */
    public function scopeInCategory($query, string $category)
    {
        return $query->where('category', $category);
    }

    /**
     * Scope for filtering by tag.
     */
    public function scopeWithTag($query, string $tag)
    {
        return $query->whereJsonContains('tags', $tag);
    }

    /**
     * Create a new version snapshot.
     */
    public function createVersionSnapshot(int $userId, array $changes = []): CustomModuleVersion
    {
        $lessonsSnapshot = $this->lessons->map(function ($lesson) {
            return [
                'id' => $lesson->id,
                'title' => $lesson->title,
                'description' => $lesson->description,
                'content_type' => $lesson->content_type,
                'order' => $lesson->order,
            ];
        })->toArray();

        return $this->versions()->create([
            'version_number' => $this->version,
            'title' => $this->title,
            'description' => $this->description,
            'lessons_snapshot' => $lessonsSnapshot,
            'changes' => $changes,
            'created_by' => $userId,
        ]);
    }

    /**
     * Sync this custom module to all related course modules.
     */
    public function syncToCourseModules(): void
    {
        foreach ($this->syncedModules as $module) {
            $module->update([
                'title' => $this->title,
                'description' => $this->description,
                'logo_path' => $this->thumbnail_path,
            ]);

            // Sync lessons
            $this->syncLessonsToCourseModule($module);
        }
    }

    /**
     * Sync lessons to a specific course module.
     */
    protected function syncLessonsToCourseModule(Module $module): void
    {
        $existingLessons = $module->lessons()->pluck('custom_lesson_id', 'id')->filter();

        foreach ($this->lessons as $customLesson) {
            $lessonData = [
                'module_id' => $module->id,
                'custom_lesson_id' => $customLesson->id,
                'title' => $customLesson->title,
                'type' => ucfirst($customLesson->content_type),
                'text_content' => $customLesson->text_content,
                'content_path' => $customLesson->content_path ?? $customLesson->content_url,
                'duration' => $customLesson->duration,
                'file_size' => $customLesson->file_size,
                'status' => $customLesson->status === 'published' ? 'Active' : 'Draft',
                'order' => $customLesson->order,
            ];

            $existingLesson = $module->lessons()->where('custom_lesson_id', $customLesson->id)->first();

            if ($existingLesson) {
                $existingLesson->update($lessonData);
            } else {
                $module->lessons()->create($lessonData);
            }
        }

        // Remove lessons that no longer exist in custom module
        $customLessonIds = $this->lessons->pluck('id')->toArray();
        $module->lessons()
            ->whereNotNull('custom_lesson_id')
            ->whereNotIn('custom_lesson_id', $customLessonIds)
            ->delete();
    }
}
