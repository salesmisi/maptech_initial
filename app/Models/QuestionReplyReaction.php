<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class QuestionReplyReaction extends Model
{
    protected $fillable = ['reply_id', 'user_id', 'emoji'];

    public function reply()
    {
        return $this->belongsTo(QuestionReply::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
