<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property int $id
 * @property int $question_id
 * @property string $option_text
 * @property bool $is_correct
 * @property int $order
 * @property \Carbon\Carbon $created_at
 * @property \Carbon\Carbon $updated_at
 * @property-read QuizQuestion $question
 */
class QuizOption extends Model
{
    protected $fillable = ['question_id', 'option_text', 'is_correct', 'order'];

    protected $casts = ['is_correct' => 'boolean'];

    public function question(): BelongsTo
    {
        return $this->belongsTo(QuizQuestion::class, 'question_id');
    }
}
