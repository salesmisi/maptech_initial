<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class SentHistory extends Model
{
    use SoftDeletes;

    protected $table = 'sent_history';

    protected $fillable = [
        'sender_id',
        'title',
        'message',
        'target',
        'announcement_mode',
        'data',
        'target_roles',
        'department_id',
        'subdepartment_id',
        'recipients_count',
    ];

    protected $casts = [
        'data' => 'array',
        'target_roles' => 'array',
        'deleted_at' => 'datetime',
    ];

    /**
     * The maximum number of sent history entries to keep before auto-deleting.
     */
    public const HISTORY_LIMIT = 50;

    /**
     * Get the user who sent the announcement.
     */
    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    /**
     * Get the department this announcement was sent to.
     */
    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    /**
     * Get the subdepartment this announcement was sent to.
     */
    public function subdepartment(): BelongsTo
    {
        return $this->belongsTo(Subdepartment::class);
    }

    /**
     * Check if the sent history limit has been exceeded and auto-delete oldest entries.
     * This should be called after creating a new sent history entry.
     *
     * @param int $senderId The sender's user ID
     */
    public static function enforceHistoryLimit(int $senderId): void
    {
        $count = static::where('sender_id', $senderId)
            ->whereNull('deleted_at')
            ->count();

        if ($count > static::HISTORY_LIMIT) {
            // Calculate how many to delete (half of the limit, rounded up)
            $deleteCount = ceil(static::HISTORY_LIMIT / 2);

            // Get the oldest entries to soft delete
            $oldestEntries = static::where('sender_id', $senderId)
                ->whereNull('deleted_at')
                ->orderBy('created_at', 'asc')
                ->take($deleteCount)
                ->get();

            /** @var \Illuminate\Database\Eloquent\Collection<int, self> $oldestEntries */
            foreach ($oldestEntries as $entry) {
                /** @var self $entry */
                $entry->delete(); // Soft delete
            }
        }
    }

    /**
     * Permanently delete entries older than a certain number of days from recently deleted.
     * Default is 30 days.
     *
     * @param int $days Number of days after which to permanently delete
     */
    public static function cleanupRecentlyDeleted(int $days = 30): int
    {
        return static::onlyTrashed()
            ->where('deleted_at', '<', now()->subDays($days))
            ->forceDelete();
    }

    /**
     * Get recently deleted entries for a sender.
     */
    public static function getRecentlyDeleted(int $senderId, int $limit = 50)
    {
        return static::onlyTrashed()
            ->where('sender_id', $senderId)
            ->orderByDesc('deleted_at')
            ->take($limit)
            ->get();
    }

    /**
     * Enforce trash limit: if recently deleted count >= 50, permanently delete oldest half.
     *
     * @param int $senderId The sender's user ID
     * @return int Number of permanently deleted entries
     */
    public static function enforceTrashLimit(int $senderId): int
    {
        $trashedCount = static::onlyTrashed()
            ->where('sender_id', $senderId)
            ->count();

        if ($trashedCount >= 50) {
            $halfCount = (int) floor($trashedCount / 2);
            $oldestIds = static::onlyTrashed()
                ->where('sender_id', $senderId)
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
