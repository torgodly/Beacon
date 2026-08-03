<?php

namespace App\Services\Nginx;

use App\Models\Site;
use App\Models\SiteDomain;
use App\Models\SslCertificate;
use Illuminate\Support\Facades\View;

class NginxTemplateRenderer
{
    public function __construct(private readonly NginxHttp2Directive $http2) {}

    public function render(Site $site): string
    {
        $site->loadMissing(['domains', 'sslCertificates']);

        $view = match ($site->type) {
            'laravel' => 'nginx.laravel',
            'nextjs', 'nuxt' => 'nginx.proxy',
            'static' => 'nginx.static',
            default => throw new \InvalidArgumentException("Unknown site type [{$site->type}]"),
        };

        $certificate = $site->sslCertificates
            ->first(fn (SslCertificate $cert): bool => $cert->status === 'issued');

        return View::make($view, [
            'site' => $site,
            'serverNames' => $this->serverNames($site),
            'redirects' => $site->domains->filter(
                fn (SiteDomain $domain): bool => filled($domain->redirect_to),
            ),
            'certificate' => $certificate,
            'http2Inline' => $this->http2->inline(),
        ])->render();
    }

    private function serverNames(Site $site): string
    {
        $names = $site->domains->pluck('domain')->all();

        if ($names === []) {
            return $site->name;
        }

        return implode(' ', $names);
    }
}
