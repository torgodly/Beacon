<?php

namespace Tests\Feature\Sites;

use App\Models\Server;
use App\Models\Site;
use App\Models\SiteDomain;
use App\Models\User;
use App\Services\System\ProcessFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\FakeProcessFactory;
use Tests\TestCase;

class DomainManagementTest extends TestCase
{
    use RefreshDatabase;

    private FakeProcessFactory $processFactory;

    protected function setUp(): void
    {
        parent::setUp();

        $this->processFactory = new FakeProcessFactory;
        $this->app->instance(ProcessFactory::class, $this->processFactory);
    }

    public function test_store_adds_domain_and_optional_www_redirect(): void
    {
        $this->processFactory->willReturn(0, 'server { listen 80; }');

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSiteWithDomain('app.example.com');

        $response = $this->actingAs($user)->post(route('sites.domains.store', $site), [
            'domain' => 'api.example.com',
            'redirect_www' => true,
        ]);

        $response->assertRedirect();

        $this->assertDatabaseHas('site_domains', [
            'site_id' => $site->id,
            'domain' => 'api.example.com',
            'is_primary' => false,
        ]);

        $this->assertDatabaseHas('site_domains', [
            'site_id' => $site->id,
            'domain' => 'www.api.example.com',
            'redirect_to' => 'api.example.com',
            'redirect_status_code' => 301,
        ]);
    }

    public function test_destroy_removes_non_primary_domain(): void
    {
        $this->processFactory->willReturn(0, 'server { listen 80; }');

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSiteWithDomain('app.example.com');

        $extra = SiteDomain::query()->create([
            'site_id' => $site->id,
            'domain' => 'api.example.com',
            'is_primary' => false,
        ]);

        $response = $this->actingAs($user)->delete(
            route('sites.domains.destroy', [$site, $extra->domain]),
        );

        $response->assertRedirect();
        $this->assertDatabaseMissing('site_domains', ['id' => $extra->id]);
    }

    public function test_make_primary_updates_primary_domain(): void
    {
        $this->processFactory->willReturn(0, 'server { listen 80; }');

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSiteWithDomain('app.example.com');

        $extra = SiteDomain::query()->create([
            'site_id' => $site->id,
            'domain' => 'api.example.com',
            'is_primary' => false,
        ]);

        $response = $this->actingAs($user)->patch(
            route('sites.domains.primary', [$site, $extra->domain]),
        );

        $response->assertRedirect();
        $this->assertFalse($site->domains()->where('domain', 'app.example.com')->first()->is_primary);
        $this->assertTrue($site->domains()->where('domain', 'api.example.com')->first()->is_primary);
    }

    private function createSiteWithDomain(string $name): Site
    {
        $site = Site::factory()->laravel()->create([
            'server_id' => 1,
            'name' => $name,
            'path' => '/home/beacon/'.$name,
        ]);

        SiteDomain::query()->create([
            'site_id' => $site->id,
            'domain' => $name,
            'is_primary' => true,
        ]);

        return $site;
    }
}
