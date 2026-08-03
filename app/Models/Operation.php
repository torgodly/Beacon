<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * A long-running action with a live, resumable log.
 *
 * @property int $id
 * @property string $uuid
 * @property string $type
 * @property string $title
 * @property string|null $summary
 * @property string|null $subject_type
 * @property int|null $subject_id
 * @property int|null $user_id
 * @property string $status
 * @property string $log_path
 * @property int|null $exit_code
 * @property string|null $error
 * @property Carbon|null $started_at
 * @property Carbon|null $finished_at
 * @property int|null $duration_ms
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Operation extends Model
{
    /** Statuses that keep the dock polling. */
    public const ACTIVE_STATUSES = ['queued', 'running'];

    /**
     * @var list<string>
     */
    protected $fillable = [
        'uuid',
        'type',
        'title',
        'summary',
        'subject_type',
        'subject_id',
        'user_id',
        'status',
        'log_path',
        'exit_code',
        'error',
        'started_at',
        'finished_at',
        'duration_ms',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'exit_code' => 'integer',
            'duration_ms' => 'integer',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Operation $operation): void {
            if (blank($operation->uuid)) {
                $operation->uuid = (string) Str::uuid();
            }
        });
    }

    public function getRouteKeyName(): string
    {
        return 'uuid';
    }

    /**
     * @return MorphTo<Model, $this>
     */
    public function subject(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isActive(): bool
    {
        return in_array($this->status, self::ACTIVE_STATUSES, true);
    }

    /**
     * The shape the operations dock and terminal modal consume.
     *
     * @return array<string, mixed>
     */
    public function toPayload(): array
    {
        return [
            'uuid' => $this->uuid,
            'type' => $this->type,
            'title' => $this->title,
            'summary' => $this->summary,
            'status' => $this->status,
            'exit_code' => $this->exit_code,
            'error' => $this->error,
            'started_at' => $this->started_at?->toIso8601String(),
            'finished_at' => $this->finished_at?->toIso8601String(),
            'duration_ms' => $this->duration_ms,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
