<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * @property int $id
 * @property int $quiz_id
 * @property string $question_text
 * @property string|null $image_path
 * @property string|null $video_path
 * @property int $order
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 * @property-read Quiz $quiz
 * @property-read \Illuminate\Database\Eloquent\Collection|QuizOption[] $options
 */
class QuizQuestion extends Model
{
    protected $fillable = ['quiz_id', 'question_text', 'image_path', 'video_path', 'order'];

    public function quiz(): BelongsTo
    {
        return $this->belongsTo(Quiz::class);
    }

    public function options(): HasMany
    {
        return $this->hasMany(QuizOption::class, 'question_id')->orderBy('order');
    }
}
