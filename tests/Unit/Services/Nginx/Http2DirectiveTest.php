<?php

namespace Tests\Unit\Services\Nginx;

use Illuminate\Support\Facades\View;
use Tests\TestCase;

/**
 * The standalone `http2 on;` directive was added in nginx 1.25.1. Ubuntu 24.04
 * ships 1.24, which rejects it outright with `unknown directive "http2"` and
 * refuses to start.
 *
 * NginxHttp2Directive::inline() is TRUE for those older builds, meaning "use
 * the inline `listen … http2` form". The panel-tls template had that condition
 * inverted, so attaching a domain wrote a vhost that failed `nginx -t`
 * immediately after the certificate had been issued.
 */
class Http2DirectiveTest extends TestCase
{
    /**
     * @return array<string, array{bool}>
     */
    public static function templates(): array
    {
        return [
            'laravel' => ['nginx.laravel'],
            'proxy' => ['nginx.proxy'],
            'static' => ['nginx.static'],
        ];
    }

    public function test_panel_tls_uses_the_inline_form_on_old_nginx(): void
    {
        $output = $this->renderPanelTls(http2Inline: true);

        $this->assertStringContainsString('listen 443 ssl http2;', $output);
        $this->assertStringNotContainsString('http2 on;', $output);
    }

    public function test_panel_tls_uses_the_standalone_directive_on_new_nginx(): void
    {
        $output = $this->renderPanelTls(http2Inline: false);

        $this->assertStringContainsString('http2 on;', $output);
        $this->assertStringNotContainsString('ssl http2;', $output);
    }

    public function test_panel_tls_always_serves_acme_challenges(): void
    {
        // Renewals validate over HTTP-01 against the live vhost.
        $this->assertStringContainsString(
            '/.well-known/acme-challenge/',
            $this->renderPanelTls(http2Inline: true),
        );
    }

    public function test_catch_all_does_not_swallow_acme_challenges(): void
    {
        // On an IP-only install this is the only vhost on :80. A blanket
        // `return 444` would drop Let's Encrypt's validation request and make
        // attaching a panel domain impossible.
        $conf = file_get_contents(base_path('deploy/nginx/000-catch-all.conf'));

        $this->assertIsString($conf);
        $this->assertStringContainsString('/.well-known/acme-challenge/', $conf);

        $acmeAt = strpos($conf, '/.well-known/acme-challenge/');
        $catchAllAt = strpos($conf, 'location / {');

        $this->assertNotFalse($acmeAt);
        $this->assertNotFalse($catchAllAt);
        $this->assertLessThan(
            $catchAllAt,
            $acmeAt,
            'The ACME location must be declared before the catch-all location.',
        );
    }

    /**
     * options-ssl-nginx.conf and ssl-dhparams.pem are shipped by
     * python3-certbot-nginx. Beacon does not install it — certificates come
     * from `certonly --webroot` so certbot never edits nginx config — so any
     * reference to those paths fails every TLS vhost with
     * `open() … failed (2: No such file or directory)`.
     */
    public function test_no_template_emits_certbot_plugin_files(): void
    {
        $templates = [
            ...(glob(base_path('resources/views/nginx/*.blade.php')) ?: []),
            ...(glob(base_path('resources/views/nginx/partials/*.blade.php')) ?: []),
        ];

        $this->assertNotEmpty($templates);

        foreach ($templates as $path) {
            // Blade comments are stripped at render, so strip them here too —
            // otherwise a comment *explaining* the rule trips the assertion.
            $body = preg_replace('/\{\{--.*?--\}\}/s', '', (string) file_get_contents($path));

            $this->assertStringNotContainsString('options-ssl-nginx.conf', (string) $body, basename($path));
            $this->assertStringNotContainsString('ssl-dhparams.pem', (string) $body, basename($path));
        }
    }

    public function test_tls_policy_is_defined_once_at_http_level(): void
    {
        $global = (string) file_get_contents(base_path('deploy/nginx/beacon-global.conf'));

        $this->assertStringContainsString('ssl_protocols TLSv1.2 TLSv1.3;', $global);
        $this->assertStringContainsString('ssl_ciphers', $global);
        // A shared session zone declared per-server is a duplicate-zone error.
        $this->assertStringContainsString('ssl_session_cache', $global);
    }

    private function renderPanelTls(bool $http2Inline): string
    {
        return View::make('nginx.panel-tls', [
            'domain' => 'panel.example.com',
            'panelRoot' => '/opt/beacon/panel/current',
            'panelPhp' => '8.4',
            'acmeWebroot' => '/var/www/beacon-acme',
            'http2Inline' => $http2Inline,
        ])->render();
    }
}
