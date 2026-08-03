<?php

namespace App\Actions\Site;

use App\Models\Site;
use App\Services\Nginx\NginxService;
use App\Services\Sites\SiteDirectory;
use App\Support\SiteNginxSync;

/**
 * Change how Nginx serves a site.
 *
 * Pointing the vhost at a directory that does not exist yet is the common
 * mistake here — nginx starts fine and then 404s everything — so the document
 * root is created and made group-readable before the config is regenerated.
 */
class UpdateSiteServing
{
    public function __construct(
        private readonly NginxService $nginx,
        private readonly SiteDirectory $directories,
    ) {}

    /**
     * @param  array{web_directory?: string|null, spa_fallback?: bool, client_max_body_size?: string|null, package_manager?: string|null}  $data
     */
    public function handle(Site $site, array $data): Site
    {
        $attributes = array_filter(
            [
                'web_directory' => $data['web_directory'] ?? null,
                'client_max_body_size' => $data['client_max_body_size'] ?? null,
                'package_manager' => $data['package_manager'] ?? null,
            ],
            fn (?string $value): bool => $value !== null && $value !== '',
        );

        if (array_key_exists('spa_fallback', $data)) {
            $attributes['spa_fallback'] = (bool) $data['spa_fallback'];
        }

        $site->update($attributes);
        $site = $site->fresh();

        $this->directories->ensureWebRoot($site);

        SiteNginxSync::refresh($site, $this->nginx);

        $site->activity()->with([
            'web_directory' => $site->web_directory,
            'spa_fallback' => $site->spa_fallback,
        ])->log('site.serving_updated');

        return $site->fresh(['domains', 'sslCertificates']);
    }
}
