<?php

namespace App\Actions\Site;

use App\Models\Server;
use App\Models\Site;
use App\Services\Cron\CronService;
use App\Services\Nginx\NginxService;
use App\Services\Php\PhpPoolWriter;
use App\Services\Ssl\CertbotService;
use App\Services\Supervisor\SsrLauncher;
use App\Services\Supervisor\SupervisorService;
use App\Services\System\ProcessRunner;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use RuntimeException;

class DeleteSite
{
    public function __construct(
        private readonly NginxService $nginx,
        private readonly PhpPoolWriter $pools,
        private readonly ProcessRunner $runner,
        private readonly CertbotService $certbot,
        private readonly SupervisorService $supervisor,
        private readonly SsrLauncher $ssrLauncher,
        private readonly CronService $cron,
    ) {}

    public function handle(Site $site, string $confirmation): void
    {
        if ($confirmation !== $site->name) {
            throw new RuntimeException('Site name confirmation did not match.');
        }

        if (in_array($site->deployment_status, ['queued', 'running'], true)) {
            throw new RuntimeException('Wait for the in-flight deployment to finish before deleting this site.');
        }

        $site->load([
            'supervisorProcesses',
            'deployments',
            'commands',
            'cronJobs',
        ]);

        DB::transaction(function () use ($site): void {
            $this->supervisor->deleteAllForSite($site);

            if (SsrLauncher::supports($site->type)) {
                $this->ssrLauncher->remove($site);
            }

            if ($site->cronJobs->isNotEmpty()) {
                $server = Server::query()->findOrFail($site->server_id);
                $site->cronJobs()->delete();
                $this->cron->sync($server);
            }

            $this->nginx->delete($site);
            $this->certbot->deleteAllForSite($site);
            $this->pools->delete($site);

            $this->removeHostArtifacts($site);

            $site->update(['last_deployment_id' => null]);
            $site->activityLogs()->delete();
            $site->forceDelete();
        });
    }

    private function removeHostArtifacts(Site $site): void
    {
        $paths = $this->artifactPaths($site);

        $result = $this->runner->asSite(
            argv: ['/bin/rm', '-rf', $site->path],
            cwd: rtrim((string) config('beacon.paths.sites_home'), '/'),
        );

        if ($result->failed()) {
            throw new RuntimeException("Could not remove site directory: {$result->errorOutput()}");
        }

        foreach ($paths as $path) {
            if ($path === $site->path) {
                continue;
            }

            if (str_starts_with($path, '/home/beacon/')) {
                $this->runner->asSite(
                    argv: ['/bin/rm', '-f', $path],
                    cwd: rtrim((string) config('beacon.paths.sites_home'), '/'),
                );

                continue;
            }

            if (File::exists($path)) {
                File::delete($path);
            }
        }
    }

    /**
     * @return list<string>
     */
    private function artifactPaths(Site $site): array
    {
        $paths = [
            $site->path,
            $site->deployScriptPath(),
        ];

        if (filled($site->deploy_key_path)) {
            $paths[] = $site->deploy_key_path;
            $paths[] = "{$site->deploy_key_path}.pub";
        }

        if (SsrLauncher::supports($site->type)) {
            $paths[] = $this->ssrLauncher->path($site);
        }

        foreach ($site->deployments as $deployment) {
            if (filled($deployment->log_path)) {
                $paths[] = $deployment->log_path;
            }
        }

        foreach ($site->commands as $command) {
            if (filled($command->log_path)) {
                $paths[] = $command->log_path;
            }
        }

        foreach ($site->supervisorProcesses as $process) {
            if (filled($process->log_path)) {
                $paths[] = $process->log_path;
            }
        }

        return array_values(array_unique($paths));
    }
}
