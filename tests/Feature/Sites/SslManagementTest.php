<?php

namespace Tests\Feature\Sites;

use App\Models\Server;
use App\Models\Site;
use App\Models\SiteDomain;
use App\Models\SslCertificate;
use App\Models\User;
use App\Services\System\ProcessFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\FakeProcessFactory;
use Tests\TestCase;

class SslManagementTest extends TestCase
{
    use RefreshDatabase;

    private FakeProcessFactory $processFactory;

    protected function setUp(): void
    {
        parent::setUp();

        $this->processFactory = new FakeProcessFactory;
        $this->app->instance(ProcessFactory::class, $this->processFactory);
    }

    public function test_issue_creates_certificate_record(): void
    {
        $certificatesOutput = <<<'OUTPUT'
Found the following certs:
  Certificate Name: app.example.com
    Domains: app.example.com
    Expiry Date: 2026-11-01 12:00:00+00:00 (VALID: 89 days)
    Certificate Path: /etc/letsencrypt/live/app.example.com/fullchain.pem
    Private Key Path: /etc/letsencrypt/live/app.example.com/privkey.pem
OUTPUT;

        $this->processFactory->willReturn(0, $certificatesOutput);

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSiteWithDomain('app.example.com');

        $response = $this->actingAs($user)->post(route('sites.ssl.issue', $site), [
            'email' => 'admin@example.com',
        ]);

        $response->assertRedirect();

        $this->assertDatabaseHas('ssl_certificates', [
            'site_id' => $site->id,
            'lineage' => 'app.example.com',
            'status' => 'issued',
        ]);
        $this->assertSame('issued', $site->fresh()->ssl_status);
    }

    public function test_destroy_removes_certificate(): void
    {
        $this->processFactory->willReturn(0);

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSiteWithDomain('app.example.com', sslStatus: 'issued');

        $certificate = SslCertificate::query()->create([
            'site_id' => $site->id,
            'provider' => 'letsencrypt',
            'lineage' => 'app.example.com',
            'domains' => ['app.example.com'],
            'status' => 'issued',
        ]);

        $response = $this->actingAs($user)->delete(
            route('sites.ssl.destroy', [$site, $certificate]),
        );

        $response->assertRedirect();
        $this->assertDatabaseMissing('ssl_certificates', ['id' => $certificate->id]);
        $this->assertSame('none', $site->fresh()->ssl_status);
    }

    public function test_show_includes_ssl_payload_on_ssl_tab(): void
    {
        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSiteWithDomain('app.example.com', sslStatus: 'issued');

        SslCertificate::query()->create([
            'site_id' => $site->id,
            'provider' => 'letsencrypt',
            'lineage' => 'app.example.com',
            'domains' => ['app.example.com'],
            'status' => 'issued',
            'expires_at' => now()->addDays(30),
        ]);

        $response = $this->actingAs($user)->get(
            route('sites.show', $site->name).'?tab=ssl',
        );

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('sites/show')
            ->where('tab', 'ssl')
            ->where('sslCertificate.lineage', 'app.example.com')
        );
    }

    private function createSiteWithDomain(string $name, string $sslStatus = 'none'): Site
    {
        $site = Site::factory()->laravel()->create([
            'server_id' => 1,
            'name' => $name,
            'path' => '/home/beacon/'.$name,
            'ssl_status' => $sslStatus,
        ]);

        SiteDomain::query()->create([
            'site_id' => $site->id,
            'domain' => $name,
            'is_primary' => true,
        ]);

        return $site;
    }
}
