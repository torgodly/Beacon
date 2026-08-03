<?php

namespace App\Models;

use Database\Factories\GithubInstallationFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $user_id
 * @property int $app_id
 * @property string $app_slug
 * @property string $client_id
 * @property string $client_secret
 * @property string $private_key
 * @property string $webhook_secret
 * @property int|null $installation_id
 * @property string|null $account_login
 * @property string|null $account_type
 * @property array<string, mixed>|null $permissions
 * @property string|null $webhook_url
 * @property bool $webhook_reachable
 * @property Carbon|null $last_delivery_at
 * @property int|null $last_delivery_status
 * @property Carbon|null $connected_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class GithubInstallation extends Model
{
    /** @use HasFactory<GithubInstallationFactory> */
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'app_id',
        'app_slug',
        'client_id',
        'client_secret',
        'private_key',
        'webhook_secret',
        'installation_id',
        'account_login',
        'account_type',
        'permissions',
        'webhook_url',
        'webhook_reachable',
        'last_delivery_at',
        'last_delivery_status',
        'connected_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'client_secret' => 'encrypted',
            'private_key' => 'encrypted',
            'webhook_secret' => 'encrypted',
            'permissions' => 'array',
            'webhook_reachable' => 'boolean',
            'last_delivery_at' => 'datetime',
            'last_delivery_status' => 'integer',
            'connected_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * @return HasMany<WebhookDelivery, $this>
     */
    public function webhookDeliveries(): HasMany
    {
        return $this->hasMany(WebhookDelivery::class);
    }
}
