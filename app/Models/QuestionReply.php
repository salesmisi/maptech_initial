<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QuestionReply extends Model
{
    protected $fillable = ['question_id', 'user_id', 'message'];

    public function question()
    {
        return $this->belongsTo(Question::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function reactions()
    {
        return $this->hasMany(QuestionReplyReaction::class, 'reply_id');
    }
}
