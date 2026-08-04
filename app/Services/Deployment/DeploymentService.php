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

    private function restartProcesses(Site $site, OutputStream $stream): void
    {
        $supervisor = app(SupervisorService::class);

        // The build just produced the SSR bundle, so the Node server can now
        // actually start. Re-render the launcher too — the site's Node version
        // or proxy port may have changed since it was last written.
        if (SsrLauncher::supports($site->type)) {
            $stream->append("Registering SSR server…\n");
            $supervisor->syncSsrProcess($site, autostart: true);
        }

        $supervisor->restartAllForSite($site, $stream);
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
