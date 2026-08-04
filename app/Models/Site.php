<?php

namespace App\Models;

use App\Models\Concerns\LogsActivity;
use Database\Factories\SiteFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property string $uuid
 * @property int $server_id
 * @property string $name
 * @property string $type
 * @property string $path
 * @property string $web_directory
 * @property string $system_user
 * @property string|null $php_version
 * @property int|null $database_id
 * @property int|null $database_user_id
 * @property string|null $node_version
 * @property string|null $package_manager
 * @property int|null $proxy_port
 * @property bool $spa_fallback
 * @property string $client_max_body_size
 * @property bool $open_basedir
 * @property array<int, string>|null $open_basedir_extra_paths
 * @property bool $strict_functions
 * @property string|null $repository_provider
 * @property string|null $repository
 * @property string|null $repository_branch
 * @property int|null $github_installation_id
 * @property int|null $github_repo_id
 * @property string|null $deploy_key_path
 * @property string|null $deploy_key_public
 * @property bool $auto_deploy
 * @property string $deploy_trigger
 * @property string|null $last_polled_sha
 * @property Carbon|null $last_polled_at
 * @property int|null $poll_interval_seconds
 * @property string|null $deploy_script
 * @property string $deployment_status
 * @property Carbon|null $last_deployed_at
 * @property int|null $last_deployment_id
 * @property bool $nginx_customized
 * @property string|null $nginx_managed_hash
 * @property string $ssl_status
 * @property string $status
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property Carbon|null $deleted_at
 */
class Site extends Model
{
    /** @use HasFactory<SiteFactory> */
    use HasFactory, LogsActivity, SoftDeletes;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'uuid',
        'server_id',
        'name',
        'type',
        'path',
        'web_directory',
        'system_user',
        'php_version',
        'database_id',
        'database_user_id',
        'node_version',
        'package_manager',
        'proxy_port',
        'spa_fallback',
        'client_max_body_size',
        'open_basedir',
        'open_basedir_extra_paths',
        'strict_functions',
        'repository_provider',
        'repository',
        'repository_branch',
        'github_installation_id',
        'github_repo_id',
        'deploy_key_path',
        'deploy_key_public',
        'auto_deploy',
        'deploy_trigger',
        'last_polled_sha',
        'last_polled_at',
        'poll_interval_seconds',
        'deploy_script',
        'deployment_status',
        'last_deployed_at',
        'last_deployment_id',
        'nginx_customized',
        'nginx_managed_hash',
        'ssl_status',
        'status',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'proxy_port' => 'integer',
            'spa_fallback' => 'boolean',
            'open_basedir' => 'boolean',
            'open_basedir_extra_paths' => 'array',
            'strict_functions' => 'boolean',
            'auto_deploy' => 'boolean',
            'poll_interval_seconds' => 'integer',
            'last_polled_at' => 'datetime',
            'last_deployed_at' => 'datetime',
            'nginx_customized' => 'boolean',
            'deleted_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Site $site): void {
            if (blank($site->uuid)) {
                $site->uuid = (string) Str::uuid();
            }
        });
    }

    /**
     * @return BelongsTo<Server, $this>
     */
    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }

    /**
     * @return BelongsTo<GithubInstallation, $this>
     */
    public function githubInstallation(): BelongsTo
    {
        return $this->belongsTo(GithubInstallation::class);
    }

    /**
     * @return BelongsTo<Database, $this>
     */
    public function database(): BelongsTo
    {
        return $this->belongsTo(Database::class);
    }

    /**
     * @return BelongsTo<DatabaseUser, $this>
     */
    public function databaseUser(): BelongsTo
    {
        return $this->belongsTo(DatabaseUser::class);
    }

    /**
     * @return HasMany<SiteDomain, $this>
     */
    public function domains(): HasMany
    {
        return $this->hasMany(SiteDomain::class);
    }

    /**
     * @return HasMany<SslCertificate, $this>
     */
    public function sslCertificates(): HasMany
    {
        return $this->hasMany(SslCertificate::class);
    }

    /**
     * @return HasMany<EnvSnapshot, $this>
     */
    public function envSnapshots(): HasMany
    {
        return $this->hasMany(EnvSnapshot::class);
    }

    /**
     * @return HasMany<Deployment, $this>
     */
    public function deployments(): HasMany
    {
        return $this->hasMany(Deployment::class);
    }

    /**
     * @return BelongsTo<Deployment, $this>
     */
    public function lastDeployment(): BelongsTo
    {
        return $this->belongsTo(Deployment::class, 'last_deployment_id');
    }

    /**
     * @return HasMany<SiteCommand, $this>
     */
    public function commands(): HasMany
    {
        return $this->hasMany(SiteCommand::class);
    }

    /**
     * @return HasMany<SupervisorProcess, $this>
     */
    public function supervisorProcesses(): HasMany
    {
        return $this->hasMany(SupervisorProcess::class);
    }

    /**
     * @return HasMany<CronJob, $this>
     */
    public function cronJobs(): HasMany
    {
        return $this->hasMany(CronJob::class);
    }

    public function getRouteKeyName(): string
    {
        return 'name';
    }

    /**
     * FPM pool name derived from the site name (dots → hyphens).
     */
    public function poolName(): string
    {
        return str_replace('.', '-', $this->name);
    }

    /**
     * OS user the site's FPM pool and workers run as.
     *
     * Eloquent does not hydrate DB defaults onto the model until refresh, so a
     * site created without an explicit system_user would otherwise render an
     * empty `user =` line in the pool — which php-fpm treats as root and
     * refuses to start.
     */
    public function runAsUser(): string
    {
        $user = filled($this->system_user)
            ? $this->system_user
            : (string) config('beacon.site_user', 'beacon');

        return $user === 'root' ? (string) config('beacon.site_user', 'beacon') : $user;
    }

    /**
     * Nginx upstream identifier — must be a valid nginx variable suffix.
     */
    public function upstreamName(): string
    {
        return str_replace(['.', '-'], '_', $this->name);
    }

    /**
     * Absolute path to this site's editable deploy script on the host.
     */
    public function deployScriptPath(): string
    {
        return rtrim((string) config('beacon.paths.deploy_scripts'), '/')."/{$this->name}.sh";
    }

    public function envPath(): string
    {
        return "{$this->path}/.env";
    }

    public function effectivePollIntervalSeconds(): int
    {
        $min = (int) config('beacon.deployments.min_poll_interval_seconds', 30);
        $max = (int) config('beacon.deployments.max_poll_interval_seconds', 3600);

        if ($this->poll_interval_seconds !== null) {
            return max($min, min($max, $this->poll_interval_seconds));
        }

        return Server::current()->deployPollIntervalSeconds();
    }
}
