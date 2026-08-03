<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $github_installation_id
 * @property string $delivery_id
 * @property string $event
 * @property string|null $repository
 * @property int|null $status_code
 * @property int|null $duration_ms
 * @property Carbon|null $redelivered_at
 * @property string $payload_digest
 * @property Carbon|null $created_at
 */
class WebhookDelivery extends Model
{
    public const UPDATED_AT = null;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'github_installation_id',
        'delivery_id',
        'event',
        'repository',
        'status_code',
        'duration_ms',
        'redelivered_at',
        'payload_digest',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status_code' => 'integer',
            'duration_ms' => 'integer',
            'redelivered_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<GithubInstallation, $this>
     */
    public function githubInstallation(): BelongsTo
    {
        return $this->belongsTo(GithubInstallation::class);
    }
}
