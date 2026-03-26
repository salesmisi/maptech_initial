<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LessonFeedbackReply extends Model
{
    protected $table = 'lesson_feedback_replies';

    protected $fillable = [
        'lesson_feedback_id',
        'user_id',
        'comment',
    ];

    public function feedback(): BelongsTo
    {
        return $this->belongsTo(LessonFeedback::class, 'lesson_feedback_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
