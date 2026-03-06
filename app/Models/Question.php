<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
<<<<<<< HEAD
=======
use Illuminate\Database\Eloquent\Relations\HasMany;
>>>>>>> origin/merge/kurt_phen

class Question extends Model
{
    protected $fillable = [
        'user_id',
<<<<<<< HEAD
        'course',
        'department',
        'question',
        'answer',
        'answered_by_id',
=======
        'course_id',
        'question',
        'answer',
        'answered_by',
>>>>>>> origin/merge/kurt_phen
        'answered_at',
    ];

    protected $casts = [
        'answered_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

<<<<<<< HEAD
    public function answeredBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'answered_by_id');
=======
    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function answerer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'answered_by');
    }

    public function replies(): HasMany
    {
        return $this->hasMany(QuestionReply::class)->orderBy('created_at', 'asc');
>>>>>>> origin/merge/kurt_phen
    }
}
