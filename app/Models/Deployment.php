<?php

namespace App\Models;

use Database\Factories\DeploymentFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property string $uuid
 * @property int $site_id
 * @property int|null $user_id
 * @property string $trigger
 * @property string $status
 * @property string|null $branch
 * @property string|null $commit_sha
 * @property string|null $commit_message
 * @property string|null $commit_author
 * @property string|null $commit_url
 * @property int|null $github_deployment_id
 * @property string $log_path
 * @property string|null $output
 * @property int|null $exit_code
 * @property string|null $failed_step
 * @property int|null $peak_memory_mb
 * @property Carbon|null $started_at
 * @property Carbon|null $finished_at
 * @property int|null $duration_ms
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Deployment extends Model
{
    /** @use HasFactory<DeploymentFactory> */
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'uuid',
        'site_id',
        'user_id',
        'trigger',
        'status',
        'branch',
        'commit_sha',
        'commit_message',
        'commit_author',
        'commit_url',
        'github_deployment_id',
        'log_path',
        'output',
        'exit_code',
        'failed_step',
        'peak_memory_mb',
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
            'peak_memory_mb' => 'integer',
            'duration_ms' => 'integer',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Deployment $deployment): void {
            if (blank($deployment->uuid)) {
                $deployment->uuid = (string) Str::uuid();
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

    public function getRouteKeyName(): string
    {
        return 'uuid';
    }
}
