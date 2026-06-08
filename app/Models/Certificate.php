<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Certificate extends Model
{
    protected $fillable = [
        'user_id',
        'course_id',
        'certificate_code',
        'completed_at',
        'score',
        'logo_path',
    ];

    protected $casts = [
        'completed_at' => 'datetime',
        'score'        => 'decimal:2',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    /**
     * Generate a unique certificate code based on course title and date.
     */
    public static function generateCode(string $courseTitle, \DateTimeInterface $completedAt): string
    {
        $words = preg_split('/\s+/', trim($courseTitle));
        $prefix = '';
        foreach ($words as $word) {
            $prefix .= strtoupper(substr($word, 0, 1));
        }
        $prefix = substr($prefix, 0, 4);
        $year = $completedAt->format('Y');
        $rand = str_pad((string) random_int(1000, 9999), 4, '0', STR_PAD_LEFT);

        return "{$prefix}-{$year}-{$rand}";
    }
}
