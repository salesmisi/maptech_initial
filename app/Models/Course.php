<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/**
 * @property string $id
 * @property string $title
 * @property string|null $description
 * @property string $department
 * @property int|null $instructor_id
 * @property string $status
 * @property \Illuminate\Support\Carbon|null $deadline
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 */
class Course extends Model
{
    use HasFactory, HasUuids;

    /**
     * The primary key type.
     */
    protected $keyType = 'string';

    /**
     * Indicates if the IDs are auto-incrementing.
     */
    public $incrementing = false;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [
        'title',
        'description',
        'department',
        'subdepartment_id',
        'instructor_id',
        'status',
        'start_date',
        'deadline',
        'logo_path',
    ];

    protected $casts = [
        'start_date' => 'datetime',
        'deadline'   => 'datetime',
    ];

    /**
     * Always interpret raw datetime strings from the database as UTC.
     * Without this override, if APP_TIMEZONE=Asia/Manila, Carbon would treat
     * the bare "Y-m-d H:i:s" strings stored in UTC as Manila time, causing an
     * 8-hour offset when the API serialises them back to ISO format.
     */
    protected function asDateTime($value): \Carbon\Carbon
    {
        if (is_string($value) && $value !== '' &&
            !str_contains($value, 'Z') &&
            !str_contains($value, '+') &&
            preg_match('/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/', $value)) {
            return \Carbon\Carbon::createFromFormat('Y-m-d H:i:s', substr($value, 0, 19), 'UTC');
        }

        return parent::asDateTime($value);
    }

    /**
     * Always serialise dates to UTC ISO-8601 so the API always emits "Z" timestamps
     * that the frontend can parse unambiguously.
     */
    protected function serializeDate(\DateTimeInterface $date): string
    {
        return \Carbon\Carbon::instance($date)->utc()->toJSON();
    }

    /**
     * Get the instructor that owns the course.
     */
    public function instructor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'instructor_id');
    }

    /**
     * Scope to filter courses by department.
     */
    public function scopeForDepartment($query, string $department)
    {
        return $query->where('department', $department);
    }

    /**
     * Scope to filter courses by subdepartment.
     */
    public function scopeForSubdepartment($query, int $subdepartmentId)
    {
        return $query->where('subdepartment_id', $subdepartmentId);
    }

    /**
     * Get the subdepartment this course belongs to.
     */
    public function subdepartment()
    {
        return $this->belongsTo(Subdepartment::class);
    }

    /**
     * Scope to get only active courses.
     */
    public function scopeActive($query)
    {
        return $query->where('status', 'Active');
    }

    /**
     * Get the modules associated with the course.
     */
    public function modules(): HasMany
    {
        return $this->hasMany(Module::class);
    }

    /**
     * Get the enrollments for this course.
     */
    public function enrollments(): HasMany
    {
        return $this->hasMany(Enrollment::class);
    }

    /**
     * Get the enrolled users for this course.
     */
    public function enrolledUsers(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'enrollments')
            ->withPivot(['status', 'progress', 'enrolled_at', 'locked'])
            ->withTimestamps();
    }
}
