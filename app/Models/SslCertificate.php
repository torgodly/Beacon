<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $site_id
 * @property string $provider
 * @property string $lineage
 * @property array<int, string> $domains
 * @property string $status
 * @property string|null $certificate_path
 * @property string|null $private_key_path
 * @property Carbon|null $issued_at
 * @property Carbon|null $expires_at
 * @property Carbon|null $last_renewed_at
 * @property bool $auto_renew
 * @property string|null $last_error
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class SslCertificate extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'site_id',
        'provider',
        'lineage',
        'domains',
        'status',
        'certificate_path',
        'private_key_path',
        'issued_at',
        'expires_at',
        'last_renewed_at',
        'auto_renew',
        'last_error',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'domains' => 'array',
            'issued_at' => 'datetime',
            'expires_at' => 'datetime',
            'last_renewed_at' => 'datetime',
            'auto_renew' => 'boolean',
        ];
    }

    /**
     * @return BelongsTo<Site, $this>
     */
    public function site(): BelongsTo
    {
        return $this->belongsTo(Site::class);
    }

    /**
     * @return HasMany<SiteDomain, $this>
     */
    public function siteDomains(): HasMany
    {
        return $this->hasMany(SiteDomain::class);
    }
}
