<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property string $fullname
 * @property string $email
 * @property string $password
 * @property string $role
 * @property string|null $department
 * @property string $status
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 */
class User extends Authenticatable
{
    use HasFactory, Notifiable, HasApiTokens;

    /**
     * The attributes that are mass assignable.
     */
    protected $fillable = [

        // support both column name variants (legacy inconsistencies)
        'fullName',
        'fullname',
        'email',
        'password',
        'recovery_key_hash',
        'recovery_key',
        'role',
        'department',
        'company_role',
        'personal_gmail',
        'subdepartment_id',
        'status',
        'profile_picture',
        'signature_path',
    ];

    /**
     * The attributes that should be hidden for serialization.
     */
    protected $hidden = [
        'password',
        'recovery_key_hash',
        'recovery_key',
        'remember_token',
    ];

    /**
     * Generate a new recovery key (16 characters, alphanumeric with dashes for readability).
     * Returns the plain recovery key - store only the hash.
     */
    public static function generateRecoveryKey(): string
    {
        // Generate 16 random uppercase alphanumeric characters
        $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars: I, O, 0, 1
        $key = '';
        for ($i = 0; $i < 16; $i++) {
            $key .= $chars[random_int(0, strlen($chars) - 1)];
        }
        // Format as XXXX-XXXX-XXXX-XXXX for readability
        return implode('-', str_split($key, 4));
    }

    /**
     * Set recovery key by storing its hash.
     */
    public function setRecoveryKey(string $plainKey): void
    {
        $this->recovery_key_hash = hash('sha256', $plainKey);
        $this->save();
    }

    /**
     * Verify a recovery key against the stored hash.
     */
    public function verifyRecoveryKey(string $plainKey): bool
    {
        if (!$this->recovery_key_hash) {
            return false;
        }
        return hash_equals($this->recovery_key_hash, hash('sha256', $plainKey));
    }

    /**
     * Get the attributes that should be cast.
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    /**
     * Get the role with proper capitalization.
     */
    public function getRoleAttribute($value): string
    {
        return ucfirst(strtolower($value ?? 'Employee'));
    }

    /**
     * Set the role with lowercase storage.
     */
    public function setRoleAttribute($value): void
    {
        $this->attributes['role'] = strtolower($value ?? 'employee');
    }

    /**
     * Check if user is active.
     */
    public function isActive(): bool
    {
        return $this->status === 'Active';
    }

    /**
     * Check if user is admin.
     */
    public function isAdmin(): bool
    {
        return strtolower($this->role) === 'admin';
    }

    /**
     * Check if user is instructor.
     */
    public function isInstructor(): bool
    {
        return strtolower($this->role) === 'instructor';
    }

    /**
     * Check if user is employee.
     */
    public function isEmployee(): bool
    {
        return strtolower($this->role) === 'employee';
    }

    /**
     * Get courses taught by this instructor.
     */
    public function courses(): HasMany
    {
        return $this->hasMany(Course::class, 'instructor_id');
    }

    /**
     * Get the subdepartment this user belongs to (for employees).
     */
    public function subdepartment()
    {
        return $this->belongsTo(Subdepartment::class);
    }

    /**
     * Get subdepartments this user is assigned to (for instructors, many-to-many).
     */
    public function subdepartments()
    {
        return $this->belongsToMany(Subdepartment::class, 'user_subdepartment')->withTimestamps();
    }

    /**
     * Modules manually unlocked for this user (pivot `module_user`).
     */
    public function modules()
    {
        return $this->belongsToMany(Module::class, 'module_user')
            ->withPivot('unlocked', 'unlocked_at', 'unlocked_until')
            ->withTimestamps();
    }

    /**
     * Get departments where this user is the head.
     */
    public function headOfDepartments()
    {
        return $this->hasMany(Department::class, 'head_id');
    }

    /**
     * Get courses available for this employee based on department.
     */
    public function availableCourses()
    {
        if (!$this->department) {
            return Course::query()->whereRaw('1 = 0'); // Return empty
        }

        return Course::forDepartment($this->department)->active();
    }
}
