<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property string $uuid
 * @property int $site_id
 * @property int $user_id
 * @property string $command
 * @property string $status
 * @property int|null $exit_code
 * @property string $log_path
 * @property string|null $output
 * @property int|null $duration_ms
 * @property Carbon|null $started_at
 * @property Carbon|null $finished_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class SiteCommand extends Model
{
    protected $table = 'commands';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'uuid',
        'site_id',
        'user_id',
        'command',
        'status',
        'exit_code',
        'log_path',
        'output',
        'duration_ms',
        'started_at',
        'finished_at',
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
        static::creating(function (SiteCommand $command): void {
            if (blank($command->uuid)) {
                $command->uuid = (string) Str::uuid();
            }
        });
    }

    /**
     * @return BelongsTo<Site, $this>
     */
    public function site(): BelongsTo
    {
        return $this->belongsTo(Site::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
