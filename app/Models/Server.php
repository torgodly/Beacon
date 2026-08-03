<?php

namespace App\Models;

use Database\Factories\ServerFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $hostname
 * @property string $public_ip
 * @property string|null $private_ip
 * @property string $os_release
 * @property string|null $beacon_version
 * @property string $timezone
 * @property string|null $panel_domain
 * @property int $panel_port
 * @property bool $panel_url_public
 * @property string|null $wildcard_domain
 * @property string $default_php_version
 * @property string $default_node_version
 * @property string $default_package_manager
 * @property int|null $total_memory_mb
 * @property int|null $swap_mb
 * @property array<string, mixed>|null $settings
 * @property Carbon|null $provisioned_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
class Server extends Model
{
    /** @use HasFactory<ServerFactory> */
    use HasFactory;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'hostname',
        'public_ip',
        'private_ip',
        'os_release',
        'beacon_version',
        'timezone',
        'panel_domain',
        'panel_port',
        'panel_url_public',
        'wildcard_domain',
        'default_php_version',
        'default_node_version',
        'default_package_manager',
        'total_memory_mb',
        'swap_mb',
        'settings',
        'provisioned_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'panel_port' => 'integer',
            'panel_url_public' => 'boolean',
            'total_memory_mb' => 'integer',
            'swap_mb' => 'integer',
            'settings' => 'array',
            'provisioned_at' => 'datetime',
        ];
    }

    /**
     * @return HasMany<ServerMetric, $this>
     */
    public function metrics(): HasMany
    {
        return $this->hasMany(ServerMetric::class);
    }

    /**
     * @return HasMany<Site, $this>
     */
    public function sites(): HasMany
    {
        return $this->hasMany(Site::class);
    }

    /**
     * @return HasMany<PhpVersion, $this>
     */
    public function phpVersions(): HasMany
    {
        return $this->hasMany(PhpVersion::class);
    }

    /**
     * @return HasMany<NodeVersion, $this>
     */
    public function nodeVersions(): HasMany
    {
        return $this->hasMany(NodeVersion::class);
    }

    /**
     * @return HasMany<Database, $this>
     */
    public function databases(): HasMany
    {
        return $this->hasMany(Database::class);
    }

    /**
     * @return HasMany<CronJob, $this>
     */
    public function cronJobs(): HasMany
    {
        return $this->hasMany(CronJob::class);
    }

    /**
     * Beacon is single-server today — id 1 is the managed host.
     */
    public static function current(): self
    {
        return static::query()->firstOrCreate(
            ['id' => 1],
            [
                'hostname' => gethostname() ?: 'localhost',
                'public_ip' => '127.0.0.1',
                'os_release' => PHP_OS,
                'beacon_version' => '0.1.0-dev',
                'timezone' => config('app.timezone', 'UTC'),
                'default_php_version' => config('beacon.sites.default_php_version', '8.4'),
                'default_node_version' => config('beacon.sites.default_node_version', '22'),
                'default_package_manager' => config('beacon.sites.default_package_manager', 'npm'),
                'provisioned_at' => now(),
            ],
        );
    }
}
