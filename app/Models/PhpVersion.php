<?php

namespace App\Models;

use Database\Factories\PhpVersionFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property int $server_id
 * @property string $version
 * @property string $status
 * @property bool $is_default
 * @property Carbon|null $installed_at
 * @property string|null $last_error
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class PhpVersion extends Model
{
    /** @use HasFactory<PhpVersionFactory> */
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'server_id',
        'version',
        'status',
        'is_default',
        'installed_at',
        'last_error',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
            'installed_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Server, $this>
     */
    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }

    /**
     * @return HasMany<PhpExtension, $this>
     */
    public function extensions(): HasMany
    {
        return $this->hasMany(PhpExtension::class);
    }

    /**
     * @return HasMany<PhpSetting, $this>
     */
    public function settings(): HasMany
    {
        return $this->hasMany(PhpSetting::class);
    }
}
