<?php

namespace Tests\Unit\Services\Nginx;

use App\Models\Server;
use App\Models\Site;
use App\Models\SiteDomain;
use App\Services\Nginx\NginxHttp2Directive;
use App\Services\Nginx\NginxTemplateRenderer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\AssertsTemplateFixtures;
use Tests\TestCase;

class NginxTemplateSnapshotTest extends TestCase
{
    use AssertsTemplateFixtures;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Server::factory()->create(['id' => 1]);

        $this->mock(NginxHttp2Directive::class, function ($mock): void {
            $mock->shouldReceive('inline')->andReturn(true);
        });
    }

    public function test_laravel_vhost_matches_fixture(): void
    {
        $site = $this->site('laravel', [
            'name' => 'app.example.com',
            'path' => '/home/beacon/app.example.com',
            'php_version' => '8.4',
        ]);

        $output = app(NginxTemplateRenderer::class)->render($site);

        $this->assertMatchesTemplateFixture('nginx/laravel.conf', $output);
        $this->assertStringContainsString('Managed by Beacon', $output);
        $this->assertStringContainsString('php8.4-fpm-app-example-com.sock', $output);
    }

    public function test_proxy_vhost_matches_fixture(): void
    {
        $site = $this->site('nextjs', [
            'name' => 'spa.example.com',
            'path' => '/home/beacon/spa.example.com',
            'proxy_port' => 3001,
            'node_version' => '22',
        ]);

        $output = app(NginxTemplateRenderer::class)->render($site);

        $this->assertMatchesTemplateFixture('nginx/proxy-nextjs.conf', $output);
        $this->assertStringContainsString('upstream beacon_spa_example_com', $output);
        $this->assertStringContainsString('127.0.0.1:3001', $output);
    }

    public function test_static_vhost_matches_fixture(): void
    {
        $site = $this->site('static', [
            'name' => 'static.example.com',
            'path' => '/home/beacon/static.example.com',
            'web_directory' => '/public',
            'spa_fallback' => true,
            'php_version' => null,
        ]);

        $output = app(NginxTemplateRenderer::class)->render($site);

        $this->assertMatchesTemplateFixture('nginx/static.conf', $output);
        $this->assertStringContainsString('try_files $uri $uri/ /index.html', $output);
    }

    public function test_laravel_vhost_with_tls_matches_fixture(): void
    {
        $site = $this->site('laravel', [
            'name' => 'secure.example.com',
            'path' => '/home/beacon/secure.example.com',
            'php_version' => '8.3',
            'ssl_status' => 'issued',
        ]);

        $site->sslCertificates()->create([
            'lineage' => 'secure.example.com',
            'domains' => ['secure.example.com'],
            'status' => 'issued',
            'expires_at' => now()->addDays(90),
            'auto_renew' => true,
        ]);

        $output = app(NginxTemplateRenderer::class)->render($site->fresh());

        $this->assertMatchesTemplateFixture('nginx/laravel-tls.conf', $output);
        $this->assertStringContainsString('/etc/letsencrypt/live/secure.example.com/fullchain.pem', $output);
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function site(string $type, array $attributes = []): Site
    {
        $site = Site::factory()->create(array_merge([
            'server_id' => 1,
            'type' => $type,
        ], $attributes));

        SiteDomain::query()->create([
            'site_id' => $site->id,
            'domain' => $site->name,
            'is_primary' => true,
        ]);

        return $site->fresh(['domains', 'sslCertificates']);
    }
}
