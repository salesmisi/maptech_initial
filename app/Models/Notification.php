<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Cache;
use App\Events\NotificationCreated;
use App\Events\NotificationCountUpdated;

class Notification extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'user_id',
        'course_id',
        'module_id',
        'type',
        'title',
        'message',
        'data',
        'read_at',
    ];

    protected $casts = [
        'data' => 'array',
        'read_at' => 'datetime',
        'deleted_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function module(): BelongsTo
    {
        return $this->belongsTo(Module::class);
    }

    public function scopeUnread($query)
    {
        return $query->whereNull('read_at');
    }

    protected static function booted()
    {
        static::created(function (Notification $notification) {
            // Clear cached unread count and broadcast the new notification
            Cache::forget("user:{$notification->user_id}:notifications:unread_count");
            event(new NotificationCreated($notification));

            // broadcast updated count
            $count = Notification::where('user_id', $notification->user_id)->whereNull('read_at')->count();
            event(new NotificationCountUpdated($notification->user_id, $count));
        });

        static::updated(function (Notification $notification) {
            // If read_at changed, clear cache and broadcast new count
            if ($notification->wasChanged('read_at')) {
                Cache::forget("user:{$notification->user_id}:notifications:unread_count");
                $count = Notification::where('user_id', $notification->user_id)->whereNull('read_at')->count();
                event(new NotificationCountUpdated($notification->user_id, $count));
            }
        });
    }

    /**
     * Enforce trash limit: if recently deleted count >= 50, permanently delete oldest half.
     *
     * @param int $userId The user's ID
     * @return int Number of permanently deleted entries
     */
    public static function enforceTrashLimit(int $userId): int
    {
        $trashedCount = static::onlyTrashed()
            ->where('user_id', $userId)
            ->count();

        if ($trashedCount >= 50) {
            $halfCount = (int) floor($trashedCount / 2);
            $oldestIds = static::onlyTrashed()
                ->where('user_id', $userId)
                ->orderBy('deleted_at', 'asc')
                ->limit($halfCount)
                ->pluck('id');

            return static::onlyTrashed()
                ->whereIn('id', $oldestIds)
                ->forceDelete();
        }

        return 0;
    }
}
