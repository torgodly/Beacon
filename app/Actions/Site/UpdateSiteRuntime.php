<?php

namespace App\Actions\Site;

use App\Models\PhpVersion;
use App\Models\Server;
use App\Models\Site;
use App\Services\Nginx\NginxService;
use App\Services\Php\PhpPoolWriter;
use App\Services\Supervisor\SupervisorService;
use App\Services\System\ProcessRunner;
use App\Services\System\SudoWrapper;
use App\Support\SiteNginxSync;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class UpdateSiteRuntime
{
    public function __construct(
        private readonly PhpPoolWriter $pools,
        private readonly NginxService $nginx,
        private readonly ProcessRunner $runner,
        private readonly SupervisorService $supervisor,
    ) {}

    /**
     * @param  array{php_version?: string|null, node_version?: string|null}  $data
     */
    public function handle(Site $site, array $data): Site
    {
        return DB::transaction(function () use ($site, $data): Site {
            $previousPhp = $site->php_version;
            $nextPhp = array_key_exists('php_version', $data)
                ? $data['php_version']
                : $previousPhp;
            $nextNode = array_key_exists('node_version', $data)
                ? $data['node_version']
                : $site->node_version;

            if ($nextPhp !== $previousPhp) {
                $this->assertPhpVersionAvailable($nextPhp);
            }

            if ($nextPhp !== $previousPhp && filled($previousPhp)) {
                $this->pools->delete($site);
            }

            $site->update([
                'php_version' => $nextPhp,
                'node_version' => $nextNode,
            ]);

            $site = $site->fresh();

            if ($nextPhp !== $previousPhp && filled($nextPhp)) {
                $this->pools->write($site);
            }

            if ($nextPhp !== $previousPhp && filled($previousPhp) && $previousPhp !== $nextPhp) {
                $this->runner->sudoRoot(
                    SudoWrapper::Php,
                    ['fpm-restart', $previousPhp],
                    timeout: 120,
                );
            }

            if (! $site->nginx_customized) {
                SiteNginxSync::refresh($site, $this->nginx);
            }

            // The launcher hard-codes the Node bin directory and port, so it has
            // to be re-rendered before anything is restarted.
            $this->supervisor->syncSsrProcess($site);

            $this->supervisor->restartAllForSite($site);

            $site->activity()->with([
                'php_version' => $nextPhp,
                'node_version' => $nextNode,
            ])->log('site.runtime_updated');

            return $site->fresh(['domains', 'sslCertificates']);
        });
    }

    private function assertPhpVersionAvailable(?string $version): void
    {
        if (blank($version)) {
            return;
        }

        if (! in_array($version, config('beacon.php_versions', []), true)) {
            throw new RuntimeException("PHP {$version} is not supported on this server.");
        }

        $installed = PhpVersion::query()
            ->where('server_id', Server::current()->id)
            ->where('version', $version)
            ->where('status', 'installed')
            ->exists();

        if (! $installed && ! app()->environment('testing')) {
            throw new RuntimeException("PHP {$version} is not installed yet.");
        }
    }
}
