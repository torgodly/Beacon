<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $site_id
 * @property string $domain
 * @property bool $is_primary
 * @property string|null $redirect_to
 * @property int|null $redirect_status_code
 * @property int|null $ssl_certificate_id
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class SiteDomain extends Model
{
    /**
     * @var list<string>
     */
    protected $fillable = [
        'site_id',
        'domain',
        'is_primary',
        'redirect_to',
        'redirect_status_code',
        'ssl_certificate_id',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_primary' => 'boolean',
            'redirect_status_code' => 'integer',
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
     * @return BelongsTo<SslCertificate, $this>
     */
    public function sslCertificate(): BelongsTo
    {
        return $this->belongsTo(SslCertificate::class);
    }

    public function getRouteKeyName(): string
    {
        return 'domain';
    }
}
