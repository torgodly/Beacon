<?php

namespace App\Actions\Site;

use App\Models\Server;
use App\Models\Site;
use App\Models\SiteDomain;
use App\Services\Deployment\DeployScriptFactory;
use App\Services\Nginx\NginxService;
use App\Services\Nginx\PortAllocator;
use App\Services\Php\PhpPoolWriter;
use App\Services\Sites\SiteDirectory;
use App\Services\Supervisor\SupervisorService;
use App\Services\System\SiteFilesystem;
use Illuminate\Support\Facades\DB;

class CreateSite
{
    public function __construct(
        private readonly SiteDirectory $directories,
        private readonly SiteFilesystem $filesystem,
        private readonly PortAllocator $ports,
        private readonly PhpPoolWriter $pools,
        private readonly NginxService $nginx,
        private readonly DeployScriptFactory $deployScripts,
        private readonly SupervisorService $supervisor,
    ) {}

    /**
     * @param  array{name: string, type: string, php_version?: string|null, node_version?: string|null, spa_fallback?: bool, web_directory?: string|null, package_manager?: string|null, client_max_body_size?: string|null, repository?: string|null, repository_branch?: string|null}  $data
     */
    public function handle(array $data): Site
    {
        $server = Server::current();
        $repository = filled($data['repository'] ?? null) ? $data['repository'] : null;

        return DB::transaction(function () use ($data, $server, $repository): Site {
            $site = Site::query()->create([
                'server_id' => $server->id,
                'name' => $data['name'],
                'type' => $data['type'],
                'path' => rtrim((string) config('beacon.paths.sites_home'), '/').'/'.$data['name'],
                'web_directory' => $data['web_directory'] ?? $this->webDirectory($data['type']),
                'php_version' => $data['php_version'] ?? null,
                'node_version' => $data['node_version'] ?? null,
                'package_manager' => $data['package_manager'] ?? $server->default_package_manager,
                'proxy_port' => $this->needsProxyPort($data['type']) ? $this->ports->allocate() : null,
                'spa_fallback' => $data['spa_fallback'] ?? ($data['type'] === 'static'),
                'client_max_body_size' => $data['client_max_body_size'] ?? '100M',
                'repository' => $repository,
                'repository_branch' => $repository !== null
                    ? ($data['repository_branch'] ?? 'main')
                    : null,
                'repository_provider' => $repository !== null ? 'custom' : null,
                'deploy_script' => null,
                'status' => 'provisioning',
            ]);

            SiteDomain::query()->create([
                'site_id' => $site->id,
                'domain' => $site->name,
                'is_primary' => true,
            ]);

            $this->directories->provision($site);
            $this->pools->write($site);

            $script = $this->deployScripts->forSite($site);
            $site->update(['deploy_script' => $script]);
            $this->filesystem->write($site->deployScriptPath(), $script, 0700);

            $this->nginx->generateAndApply($site->fresh(['domains', 'sslCertificates']));

            // Next.js / Nuxt sites need a Node process behind the reverse proxy.
            // Registered here (stopped) so the UI can show it; started by the
            // first successful deployment, once dependencies actually exist.
            $this->supervisor->syncSsrProcess($site);

            $site->update(['status' => 'active']);
            $site->activity()->log('site.created');

            return $site->fresh(['domains']);
        });
    }

    /**
     * The directory Nginx serves, relative to the site root.
     *
     * Static sites resolve to /dist because that is what the default deploy
     * script builds and what the create form tells the operator. Returning "/"
     * here while the UI promised "/dist" meant the vhost pointed at the
     * repository root and served nothing after a successful build.
     *
     * SSR types are proxied to a local port and have no document root, so the
     * value is unused for them.
     */
    private function webDirectory(string $type): string
    {
        return match ($type) {
            'laravel' => '/public',
            'static' => '/dist',
            default => '/',
        };
    }

    private function needsProxyPort(string $type): bool
    {
        return in_array($type, ['nextjs', 'nuxt'], true);
    }
}
