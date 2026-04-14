<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TimeLog extends Model
{
    use HasFactory;

    protected $table = 'time_logs';

    // Keep offset when persisting dates so timestamptz stores the correct instant.
    protected $dateFormat = 'Y-m-d H:i:sP';

    protected $fillable = [
        'user_id',
        'session_key',
        'login_audit_log_id',
        'logout_audit_log_id',
        'time_in',
        'time_out',
        'note',
        'archived',
    ];

    protected $casts = [
        'time_in' => 'datetime',
        'time_out' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'archived' => 'boolean',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Enforce time log limit: if count >= 50, permanently delete oldest half.
     *
     * @param int $userId The user's ID
     * @return int Number of deleted entries
     */
    public static function enforceTimeLogLimit(int $userId): int
    {
        $count = static::where('user_id', $userId)->count();

        if ($count >= 50) {
            $halfCount = (int) floor($count / 2);
            $oldestIds = static::where('user_id', $userId)
                ->orderBy('time_in', 'asc')
                ->limit($halfCount)
                ->pluck('id');

            return static::whereIn('id', $oldestIds)->delete();
        }

        return 0;
    }
}
