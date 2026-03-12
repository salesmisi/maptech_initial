<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QuizFeedbackReply extends Model
{
    protected $table = 'quiz_feedback_replies';

    protected $fillable = [
        'quiz_feedback_id',
        'user_id',
        'comment',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
