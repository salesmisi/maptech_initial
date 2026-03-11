<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LessonEvent extends Model
{
    protected $fillable = [
        'user_id',
        'lesson_id',
        'event_type',
        'data',
    ];

    protected $casts = [
        'data' => 'array',
    ];
}
