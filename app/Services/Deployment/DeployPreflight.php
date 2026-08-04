<?php

namespace App\Services\Deployment;

use App\Contracts\OutputStream;
use App\Exceptions\DeploymentFailedException;
use App\Models\Site;
use App\Services\Nginx\NginxService;
use App\Services\System\SiteFilesystem;
use Throwable;

class DeployPreflight
{
    public function __construct(
        private readonly SiteFilesystem $filesystem,
        private readonly DeployScriptFactory $deployScripts,
        private readonly NginxService $nginx,
    ) {}

    public function prepare(Site $site, OutputStream $stream): void
    {
        if (blank($site->repository)) {
            return;
        }

        if ($this->deployScripts->refreshLegacyDefault($site, $this->filesystem)) {
            $stream->append("Updated deploy script for plain static sites.\n");
        }

        match ($site->type) {
            'laravel' => $this->assertFile(
                $site,
                'composer.json',
                'Laravel sites need composer.json in the repository. Check the site type or repository URL.',
            ),
            'nextjs', 'nuxt' => $this->assertFile(
                $site,
                'package.json',
                'SSR sites need package.json in the repository. Check the site type or repository URL.',
            ),
            'static' => $this->prepareStaticSite($site, $stream),
            default => null,
        };
    }

    private function prepareStaticSite(Site $site, OutputStream $stream): void
    {
        if ($this->exists("{$site->path}/package.json")) {
            return;
        }

        $documentRoot = rtrim($site->path.$site->web_directory, '/');

        if ($this->hasEntryPoint($documentRoot)) {
            return;
        }

        if ($this->hasEntryPoint($site->path) && $site->web_directory === '/dist') {
            $site->update(['web_directory' => '/']);
            $this->nginx->generateAndApply($site->fresh(['domains', 'sslCertificates']));
            $stream->append("Document root set to / — repository is plain HTML with no build step.\n");

            return;
        }

        throw new DeploymentFailedException(
            'No package.json to build from and no index.html in the configured document root. '
            .'Set the document root under Serving (use / for plain HTML, or /dist after a Vite build).',
        );
    }

    private function assertFile(Site $site, string $relativePath, string $message): void
    {
        if (! $this->exists("{$site->path}/{$relativePath}")) {
            throw new DeploymentFailedException($message);
        }
    }

    private function hasEntryPoint(string $directory): bool
    {
        return $this->exists("{$directory}/index.html")
            || $this->exists("{$directory}/index.htm");
    }

    private function exists(string $path): bool
    {
        try {
            $this->filesystem->stat($path);

            return true;
        } catch (Throwable) {
            return false;
        }
    }
}
