<?php

namespace App\Services\Deployment;

use App\Contracts\OutputStream;
use App\Exceptions\DeploymentFailedException;
use App\Jobs\RunDeployment;
use App\Models\Deployment;
use App\Models\Site;
use App\Models\User;
use App\Services\Github\DeploymentStatusReporter;
use App\Services\Runtime\MemoryBudget;
use App\Services\Ssl\CertbotService;
use App\Services\Supervisor\SsrLauncher;
use App\Services\Supervisor\SupervisorService;
use App\Services\System\ProcessResult;
use App\Services\System\ProcessRunner;
use App\Services\System\SiteFilesystem;
use App\Support\OutputStream\FileOutputStream;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Throwable;

class DeploymentService
{
    public const int SCRIPT_TIMEOUT = 1800;

    public function __construct(
        private readonly ProcessRunner $runner,
        private readonly SiteFilesystem $filesystem,
        private readonly GitService $git,
        private readonly DeployPreflight $preflight,
        private readonly DeploymentStatusReporter $github,
        private readonly CertbotService $certbot,
    ) {}

    public static function queue(
        Site $site,
        string $trigger = 'manual',
        ?User $user = null,
        ?string $commitSha = null,
    ): Deployment {
        $logDirectory = rtrim((string) config('beacon.paths.deployment_logs'), '/');
        $uuid = (string) Str::uuid();

        $deployment = Deployment::query()->create([
            'uuid' => $uuid,
            'site_id' => $site->id,
            'user_id' => $user?->id,
            'trigger' => $trigger,
            'status' => 'queued',
            'branch' => $site->repository_branch,
            'commit_sha' => $commitSha,
            'log_path' => "{$logDirectory}/{$uuid}.log",
        ]);

        $site->update(['deployment_status' => 'queued']);

        RunDeployment::dispatch($deployment);

        return $deployment;
    }

    public function run(Deployment $deployment): void
    {
        $site = $deployment->site;

        if ($site === null) {
            $deployment->update(['status' => 'failed', 'failed_step' => 'site_missing']);

            return;
        }

        $timeout = (int) config('beacon.deployments.script_timeout', self::SCRIPT_TIMEOUT);
        $lock = Cache::lock("beacon:deploy:{$site->id}", $timeout + 60);

        if (! $lock->get()) {
            $deployment->update(['status' => 'cancelled', 'failed_step' => 'lock']);
            $site->update(['deployment_status' => 'idle']);

            return;
        }

        $stream = new FileOutputStream($deployment->log_path);

        try {
            $deployment->update(['status' => 'running', 'started_at' => now()]);
            $site->update(['deployment_status' => 'running']);
            $this->github->inProgress($deployment);

            $this->step($stream, 'Fetching source', function () use ($site, $stream): void {
                $this->git->syncWorkingTree($site, $stream);
                $this->preflight->prepare($site, $stream);
            });
            $this->step($stream, 'Running deploy script', fn () => $this->runScript($site, $stream, $timeout));
            $this->step($stream, 'Normalising permissions', fn () => $this->fixPermissions($site, $stream));
            $this->step($stream, 'Restarting processes', fn () => $this->restartProcesses($site, $stream));
            $this->step($stream, 'Securing TLS', fn () => $this->maybeIssueSsl($deployment, $site, $stream));

            $this->finish($deployment, $site, 'success', 0);
            $this->github->success($deployment);
        } catch (Throwable $e) {
            $stream->append("\n\033[31m✖ {$e->getMessage()}\033[0m\n");
            $exitCode = $e instanceof DeploymentFailedException ? $e->exitCode : ($e->getCode() ?: 1);
            $this->finish($deployment, $site, 'failed', (int) $exitCode, 'deploy');
            $this->github->failure($deployment);
        } finally {
            $lock->release();
        }
    }

    /**
     * @return array<int, array{name: string, description: string, example: string|null}>
     */
    public static function deployEnvironmentReference(): array
    {
        return [
            ['name' => 'BEACON_SITE', 'description' => 'Site hostname / primary domain', 'example' => 'app.example.com'],
            ['name' => 'BEACON_SITE_DIR', 'description' => 'Absolute path to the site root', 'example' => '/home/beacon/app.example.com'],
            ['name' => 'BEACON_BRANCH', 'description' => 'Tracked Git branch for deployments', 'example' => 'main'],
            ['name' => 'BEACON_PHP', 'description' => 'PHP binary for this site', 'example' => '/usr/bin/php8.4'],
            ['name' => 'BEACON_COMPOSER', 'description' => 'Composer binary', 'example' => '/usr/local/bin/composer'],
            ['name' => 'BEACON_NODE', 'description' => 'Node.js binary for this site', 'example' => '/usr/local/node/v22/bin/node'],
            ['name' => 'BEACON_NPM', 'description' => 'npm binary for this site', 'example' => '/usr/local/node/v22/bin/npm'],
            ['name' => 'BEACON_NPX', 'description' => 'npx binary for this site', 'example' => '/usr/local/node/v22/bin/npx'],
            ['name' => 'BEACON_BUN', 'description' => 'Bun binary', 'example' => '/usr/local/bun/default/bin/bun'],
            ['name' => 'BEACON_PM', 'description' => 'Package manager (npm or bun) for this site', 'example' => '/usr/local/node/v22/bin/npm'],
            ['name' => 'BEACON_PORT', 'description' => 'Local proxy port for SSR apps', 'example' => '3001'],
            ['name' => 'BEACON_DB_HOST', 'description' => 'MySQL host when a database is linked to the site', 'example' => '127.0.0.1'],
            ['name' => 'BEACON_DB_PORT', 'description' => 'MySQL port when a database is linked to the site', 'example' => '3306'],
            ['name' => 'BEACON_DB_DATABASE', 'description' => 'Linked database name written into .env on deploy', 'example' => 'app_example_com'],
            ['name' => 'BEACON_DB_USERNAME', 'description' => 'Linked database user written into .env on deploy', 'example' => 'app_example_com_user'],
            ['name' => 'BEACON_DB_PASSWORD', 'description' => 'Linked database user password written into .env on deploy', 'example' => null],
            ['name' => 'BEACON_APP_ENV', 'description' => 'Laravel APP_ENV (testing, staging, production)', 'example' => 'production'],
            ['name' => 'BEACON_DB_DRIVER', 'description' => 'Database driver for Laravel sites (mysql or sqlite)', 'example' => 'mysql'],
            ['name' => 'BEACON_DB_SQLITE_PATH', 'description' => 'Absolute SQLite database path when driver is sqlite', 'example' => '/home/beacon/app.example.com/database/database.sqlite'],
            ['name' => 'BEACON_REDIS_ENABLED', 'description' => 'When true, cache, queue, and session drivers use Redis', 'example' => 'false'],
            ['name' => 'BEACON_REDIS_HOST', 'description' => 'Redis host written into .env when Redis is enabled', 'example' => '127.0.0.1'],
            ['name' => 'BEACON_REDIS_PORT', 'description' => 'Redis port written into .env when Redis is enabled', 'example' => '6379'],
            ['name' => 'NODE_OPTIONS', 'description' => 'Node heap cap injected for builds', 'example' => '--max-old-space-size=1024'],
            ['name' => 'PATH', 'description' => 'Process PATH with Node/Bun prefixes', 'example' => null],
            ['name' => 'HOME', 'description' => 'Site user home directory', 'example' => '/home/beacon'],
            ['name' => 'USER', 'description' => 'Site UNIX user', 'example' => 'beacon'],
            ['name' => 'CI', 'description' => 'Set to true for non-interactive builds', 'example' => 'true'],
            ['name' => 'NODE_ENV', 'description' => 'Node environment for builds', 'example' => 'production'],
            ['name' => 'COMPOSER_HOME', 'description' => 'Composer cache directory', 'example' => '/home/beacon/.composer'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function deployEnvironment(Site $site): array
    {
        $node = $site->node_version
            ? "/usr/local/node/v{$site->node_version}/bin"
            : '/usr/local/node/default/bin';

        $site->loadMissing(['database', 'databaseUser']);

        $mysql = config('database.connections.mysql_admin');
        $usesMysql = $site->type === 'laravel' && $site->database_driver === 'mysql';
        $usesSqlite = $site->type === 'laravel' && $site->database_driver === 'sqlite';

        return array_filter([
            'BEACON_SITE' => $site->name,
            'BEACON_SITE_DIR' => $site->path,
            'BEACON_BRANCH' => (string) ($site->repository_branch ?: 'main'),
            'BEACON_PHP' => $site->php_version ? "/usr/bin/php{$site->php_version}" : null,
            'BEACON_COMPOSER' => '/usr/local/bin/composer',
            'BEACON_NODE' => "{$node}/node",
            'BEACON_NPM' => "{$node}/npm",
            'BEACON_NPX' => "{$node}/npx",
            'BEACON_BUN' => '/usr/local/bun/default/bin/bun',
            'BEACON_PM' => $site->package_manager === 'bun'
                ? '/usr/local/bun/default/bin/bun'
                : "{$node}/npm",
            'BEACON_PORT' => $site->proxy_port ? (string) $site->proxy_port : null,
            'BEACON_APP_ENV' => $site->type === 'laravel' ? $site->app_env : null,
            'BEACON_DB_DRIVER' => $site->type === 'laravel' ? $site->database_driver : null,
            'BEACON_DB_SQLITE_PATH' => $usesSqlite
                ? "{$site->path}/database/database.sqlite"
                : null,
            'BEACON_DB_HOST' => $usesMysql && $site->database !== null
                ? ($mysql['host'] ?? '127.0.0.1')
                : null,
            'BEACON_DB_PORT' => $usesMysql && $site->database !== null
                ? (string) ($mysql['port'] ?? '3306')
                : null,
            'BEACON_DB_DATABASE' => $usesMysql ? $site->database?->name : null,
            'BEACON_DB_USERNAME' => $usesMysql ? $site->databaseUser?->username : null,
            'BEACON_DB_PASSWORD' => $usesMysql ? $site->databaseUser?->password : null,
            'BEACON_REDIS_ENABLED' => $site->type === 'laravel'
                ? ($site->redis_enabled ? 'true' : 'false')
                : null,
            'BEACON_REDIS_HOST' => $site->type === 'laravel' && $site->redis_enabled
                ? (string) config('database.redis.default.host', '127.0.0.1')
                : null,
            'BEACON_REDIS_PORT' => $site->type === 'laravel' && $site->redis_enabled
                ? (string) config('database.redis.default.port', '6379')
                : null,
            'NODE_OPTIONS' => '--max-old-space-size='.MemoryBudget::nodeHeapMb(),
            'PATH' => "{$node}:/usr/local/bun/default/bin:/usr/local/bin:/usr/bin:/bin",
            'HOME' => '/home/beacon',
            'USER' => 'beacon',
            'CI' => 'true',
            'NODE_ENV' => 'production',
            'COMPOSER_HOME' => '/home/beacon/.composer',
        ]);
    }

    private function step(OutputStream $stream, string $label, callable $callback): void
    {
        $stream->append("\n\033[36m▶ {$label}\033[0m\n");

        $callback();
    }

    private function runScript(Site $site, OutputStream $stream, int $timeout): ProcessResult
    {
        if (blank($site->deploy_script)) {
            throw new DeploymentFailedException('No deploy script is configured for this site.');
        }

        $this->filesystem->write($site->deployScriptPath(), $site->deploy_script, 0700);

        $result = $this->runner->asSite(
            argv: [
                '/usr/bin/timeout', '--foreground', '--kill-after=10s', "{$timeout}s",
                '/bin/bash', '-eo', 'pipefail', $site->deployScriptPath(),
            ],
            cwd: $site->path,
            env: $this->deployEnvironment($site),
            timeout: $timeout + 30,
            stream: $stream,
            oomExpendable: true,
        );

        if ($result->failed()) {
            throw new DeploymentFailedException(
                "Deployment script exited with code {$result->exitCode()}.",
                $result->exitCode() ?: 1,
            );
        }

        return $result;
    }

    private function fixPermissions(Site $site, OutputStream $stream): void
    {
        $script = <<<'BASH'
set -euo pipefail
find "$BEACON_SITE_DIR" -type d -exec chmod 2775 {} +
find "$BEACON_SITE_DIR" -type f -exec chmod 0664 {} +
chmod -R ug+rwX "$BEACON_SITE_DIR"/storage "$BEACON_SITE_DIR"/bootstrap/cache 2>/dev/null || true
chmod 0640 "$BEACON_SITE_DIR/.env" 2>/dev/null || true
chmod 0700 "$BEACON_SITE_DIR"/storage/tmp "$BEACON_SITE_DIR"/storage/sessions 2>/dev/null || true
BASH;

        $result = $this->runner->asSite(
            argv: ['/bin/bash', '-eo', 'pipefail', '-c', $script],
            cwd: $site->path,
            env: $this->deployEnvironment($site),
            timeout: 120,
            stream: $stream,
        );

        if ($result->failed()) {
            throw new DeploymentFailedException(
                "Permission normalisation failed with code {$result->exitCode()}.",
                $result->exitCode() ?: 1,
            );
        }
    }

    private function maybeIssueSsl(Deployment $deployment, Site $site, OutputStream $stream): void
    {
        if (! config('beacon.ssl.auto_issue_on_deploy', true)) {
            $stream->append("Automatic TLS issuance is disabled.\n");

            return;
        }

        if ($site->ssl_status === 'issued') {
            $stream->append("TLS is already configured for this site.\n");

            return;
        }

        $deployment->loadMissing('user');

        $email = $deployment->user?->email
            ?? config('beacon.ssl.letsencrypt_email');

        if (blank($email)) {
            $stream->append("\033[33m⚠ No Let's Encrypt email available — skipped TLS issuance. Set BEACON_LETSENCRYPT_EMAIL or deploy while signed in.\033[0m\n");

            return;
        }

        try {
            $this->certbot->issue($site, $email);
            $stream->append("\033[32m✔ TLS certificate issued for {$site->name}\033[0m\n");
        } catch (Throwable $e) {
            $stream->append("\033[33m⚠ TLS issuance failed: {$e->getMessage()}\033[0m\n");
        }
    }

    private function restartProcesses(Site $site, OutputStream $stream): void
    {
        $supervisor = app(SupervisorService::class);

        if (SsrLauncher::supports($site->type)) {
            $stream->append("Registering SSR server…\n");
            $ssr = $supervisor->syncSsrProcess($site, autostart: true);

            if ($ssr !== null) {
                $stream->append("Starting {$ssr->program_name}…\n");

                try {
                    $supervisor->ensureRunning($ssr);
                    $status = $ssr->fresh()?->status ?? 'unknown';
                    $stream->append("  → {$status}\n");
                } catch (RuntimeException $e) {
                    throw new DeploymentFailedException(
                        "SSR server failed to start: {$e->getMessage()}. "
                        ."Check {$ssr->log_path} and configure environment variables under the Env tab.",
                        1,
                    );
                }
            }
        }

        $workers = $site->supervisorProcesses()->where('kind', '!=', 'ssr')->get();

        if ($workers->isEmpty()) {
            if (! SsrLauncher::supports($site->type)) {
                $stream->append("No managed processes to restart.\n");
            }

            return;
        }

        foreach ($workers as $process) {
            $stream->append("Restarting {$process->program_name}…\n");

            try {
                $supervisor->restart($process);
                $refreshed = $process->fresh();
                $status = $refreshed !== null ? $refreshed->status : 'unknown';
                $stream->append("  → {$status}\n");
            } catch (RuntimeException $e) {
                $stream->append("  → failed: {$e->getMessage()}\n");
            }
        }
    }

    private function finish(
        Deployment $deployment,
        Site $site,
        string $status,
        int $exitCode,
        ?string $failedStep = null,
    ): void {
        $finishedAt = now();
        $startedAt = $deployment->started_at ?? $finishedAt;
        $durationMs = (int) $startedAt->diffInMilliseconds($finishedAt);
        $outputTail = $this->readOutputTail($deployment->log_path);

        $deployment->update([
            'status' => $status,
            'exit_code' => $exitCode,
            'failed_step' => $failedStep,
            'output' => $outputTail,
            'finished_at' => $finishedAt,
            'duration_ms' => $durationMs,
        ]);

        $site->update([
            'deployment_status' => $status === 'success' ? 'idle' : 'failed',
            'last_deployed_at' => $status === 'success' ? $finishedAt : $site->last_deployed_at,
            'last_deployment_id' => $deployment->id,
        ]);

        if ($status === 'success') {
            $site->activity()->log('deployment.success');
        } else {
            $site->activity()->with(['message' => $failedStep])->log('deployment.failed');
        }
    }

    private function readOutputTail(string $path): ?string
    {
        if (! is_file($path)) {
            return null;
        }

        $maxBytes = (int) config('beacon.deployments.output_tail_kb', 256) * 1024;
        $size = filesize($path);

        if ($size === false || $size <= $maxBytes) {
            return file_get_contents($path) ?: null;
        }

        $handle = fopen($path, 'rb');

        if ($handle === false) {
            return null;
        }

        fseek($handle, -$maxBytes, SEEK_END);
        $tail = fread($handle, max(1, $maxBytes));
        fclose($handle);

        return $tail === false ? null : $tail;
    }
}
