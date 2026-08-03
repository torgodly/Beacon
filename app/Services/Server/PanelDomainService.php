<?php

namespace App\Services\Server;

use App\Models\GithubInstallation;
use App\Models\Server;
use App\Services\Github\WebhookReachability;
use App\Services\Nginx\NginxHttp2Directive;
use App\Services\System\ProcessRunner;
use App\Services\System\SudoWrapper;
use Illuminate\Support\Facades\View;
use RuntimeException;

class PanelDomainService
{
    public function __construct(
        private readonly ProcessRunner $runner,
        private readonly NginxHttp2Directive $http2,
        private readonly WebhookReachability $webhooks,
    ) {}

    public function attach(Server $server, string $domain, string $email): Server
    {
        if ($server->panel_url_public && filled($server->panel_domain) && $server->panel_port === 443) {
            throw new RuntimeException('The panel already has a public domain configured.');
        }

        $result = $this->runner->sudoRoot(
            SudoWrapper::Certbot,
            ['issue', $email, $domain, $domain],
            timeout: 600,
        );

        if ($result->failed()) {
            throw new RuntimeException(trim($result->errorOutput()) ?: 'Could not issue a certificate for the panel domain.');
        }

        $contents = View::make('nginx.panel-tls', [
            'domain' => $domain,
            'panelRoot' => config('beacon.paths.panel_current'),
            'panelPhp' => $server->default_php_version,
            'acmeWebroot' => config('beacon.paths.acme_webroot'),
            'http2Inline' => $this->http2->inline(),
        ])->render();

        $write = $this->runner->sudoRoot(
            SudoWrapper::Nginx,
            ['panel-write'],
            stdin: $contents,
        );

        if ($write->failed()) {
            throw new RuntimeException(trim($write->errorOutput()) ?: 'Could not write the panel nginx configuration.');
        }

        $reload = $this->runner->sudoRoot(SudoWrapper::Nginx, ['reload']);

        if ($reload->failed()) {
            throw new RuntimeException(trim($reload->errorOutput()) ?: 'Could not reload nginx.');
        }

        $appUrl = "https://{$domain}";
        $this->updatePanelAppUrl($appUrl);

        $server->update([
            'panel_domain' => $domain,
            'panel_port' => 443,
            'panel_url_public' => true,
        ]);

        GithubInstallation::query()
            ->whereNotNull('installation_id')
            ->each(fn (GithubInstallation $installation): GithubInstallation => $this->webhooks->refresh($installation));

        return $server->fresh();
    }

    private function updatePanelAppUrl(string $url): void
    {
        $envPath = rtrim((string) config('beacon.paths.panel_shared'), '/').'/.env';

        if (! is_file($envPath) || ! is_readable($envPath) || ! is_writable($envPath)) {
            return;
        }

        $contents = file_get_contents($envPath);

        if ($contents === false) {
            return;
        }

        if (preg_match('/^APP_URL=.*$/m', $contents) === 1) {
            $contents = (string) preg_replace('/^APP_URL=.*$/m', 'APP_URL='.$url, $contents);
        } else {
            $contents = rtrim($contents)."\nAPP_URL={$url}\n";
        }

        file_put_contents($envPath, $contents);
    }
}
