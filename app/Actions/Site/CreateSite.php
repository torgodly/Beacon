<?php

namespace App\Actions\Site;

use App\Models\Server;
use App\Models\Site;
use App\Models\SiteDomain;
use App\Services\Deployment\DeployScriptFactory;
use App\Services\Nginx\NginxService;
use App\Services\Nginx\PortAllocator;
use App\Services\Php\PhpPoolWriter;
use App\Services\System\ProcessRunner;
use App\Services\System\SiteFilesystem;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class CreateSite
{
    public function __construct(
        private readonly ProcessRunner $runner,
        private readonly SiteFilesystem $filesystem,
        private readonly PortAllocator $ports,
        private readonly PhpPoolWriter $pools,
        private readonly NginxService $nginx,
        private readonly DeployScriptFactory $deployScripts,
    ) {}

    /**
     * @param  array{name: string, type: string, php_version?: string|null, node_version?: string|null, spa_fallback?: bool}  $data
     */
    public function handle(array $data): Site
    {
        $server = Server::current();

        return DB::transaction(function () use ($data, $server): Site {
            $site = Site::query()->create([
                'server_id' => $server->id,
                'name' => $data['name'],
                'type' => $data['type'],
                'path' => rtrim((string) config('beacon.paths.sites_home'), '/').'/'.$data['name'],
                'web_directory' => $this->webDirectory($data['type']),
                'php_version' => $data['php_version'] ?? null,
                'node_version' => $data['node_version'] ?? null,
                'package_manager' => $server->default_package_manager,
                'proxy_port' => $this->needsProxyPort($data['type']) ? $this->ports->allocate() : null,
                'spa_fallback' => $data['spa_fallback'] ?? false,
                'deploy_script' => null,
                'status' => 'provisioning',
            ]);

            SiteDomain::query()->create([
                'site_id' => $site->id,
                'domain' => $site->name,
                'is_primary' => true,
            ]);

            $this->provisionFilesystem($site);
            $this->pools->write($site);

            $script = $this->deployScripts->forSite($site);
            $site->update(['deploy_script' => $script]);
            $this->filesystem->write($site->deployScriptPath(), $script, 0700);

            $this->nginx->generateAndApply($site->fresh(['domains', 'sslCertificates']));

            $site->update(['status' => 'active']);
            $site->activity()->log('site.created');

            return $site->fresh(['domains']);
        });
    }

    private function webDirectory(string $type): string
    {
        return match ($type) {
            'laravel' => '/public',
            'static' => '/',
            default => '/',
        };
    }

    private function needsProxyPort(string $type): bool
    {
        return in_array($type, ['nextjs', 'nuxt'], true);
    }

    private function provisionFilesystem(Site $site): void
    {
        $path = $site->path;

        $this->mkdir($path, '0750');
        $this->mkdir("{$path}/storage/tmp", '0700');
        $this->mkdir("{$path}/storage/sessions", '0700');

        if ($site->type === 'laravel') {
            $this->mkdir("{$path}/public", '0750');
        }
    }

    private function mkdir(string $path, string $mode): void
    {
        $result = $this->runner->asSite(
            argv: ['/bin/mkdir', '-p', $path],
            cwd: rtrim((string) config('beacon.paths.sites_home'), '/'),
        );

        if ($result->failed()) {
            throw new RuntimeException("Could not create directory {$path}: {$result->errorOutput()}");
        }

        $this->runner->asSite(
            argv: ['/bin/chmod', $mode, $path],
            cwd: rtrim((string) config('beacon.paths.sites_home'), '/'),
        );
    }
}
