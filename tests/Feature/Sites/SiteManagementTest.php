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

class SiteManagementTest extends TestCase
{
    use RefreshDatabase;

    private FakeProcessFactory $processFactory;

    protected function setUp(): void
    {
        parent::setUp();

        $this->processFactory = new FakeProcessFactory;
        $this->app->instance(ProcessFactory::class, $this->processFactory);
    }

    public function test_guests_cannot_access_sites(): void
    {
        $this->get(route('sites.index'))->assertRedirect(route('login'));
    }

    public function test_sites_index_lists_existing_sites(): void
    {
        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSiteWithDomain('app.example.com');

        $response = $this->actingAs($user)->get(route('sites.index'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('sites/index')
            ->has('sites', 1)
            ->where('sites.0.name', $site->name)
        );
    }

    public function test_store_creates_a_laravel_site(): void
    {
        $this->processFactory->willReturn(0, 'server {
    listen 80;
}
');

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);

        $response = $this->actingAs($user)->post(route('sites.store'), [
            'name' => 'app.example.com',
            'type' => 'laravel',
            'php_version' => '8.4',
        ]);

        $response->assertRedirect(route('sites.show', 'app.example.com'));

        $this->assertDatabaseHas('sites', [
            'name' => 'app.example.com',
            'type' => 'laravel',
            'php_version' => '8.4',
            'status' => 'active',
        ]);

        $this->assertDatabaseHas('site_domains', [
            'domain' => 'app.example.com',
            'is_primary' => true,
        ]);
    }

    public function test_show_includes_nginx_payload_on_nginx_tab(): void
    {
        $this->processFactory->willReturn(0, 'server { listen 80; }');

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSiteWithDomain('app.example.com');

        $response = $this->actingAs($user)->get(
            route('sites.show', $site->name).'?tab=nginx',
        );

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('sites/show')
            ->where('tab', 'nginx')
            ->has('nginx.contents')
        );
    }

    public function test_update_nginx_returns_validation_error_for_invalid_config(): void
    {
        $this->processFactory->willReturn(
            65,
            '',
            '[emerg] unknown directive "bad_thing" in /tmp/nginx.conf:12',
        );

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSiteWithDomain('app.example.com');

        $response = $this->actingAs($user)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->patch(route('sites.nginx.update', $site), [
                'contents' => 'server { bad_thing on; }',
            ]);

        $response->assertSessionHasErrors(['contents', 'error_line']);
    }

    public function test_update_isolation_rewrites_php_pool(): void
    {
        $this->processFactory->willReturn(0);

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSiteWithDomain('app.example.com', strictFunctions: true);

        $response = $this->actingAs($user)->patch(route('sites.isolation.update', $site), [
            'open_basedir' => false,
            'strict_functions' => true,
        ]);

        $response->assertRedirect();
        $this->assertFalse($site->fresh()->open_basedir);
        $this->assertTrue($site->fresh()->strict_functions);
    }

    public function test_destroy_requires_matching_confirmation(): void
    {
        $this->processFactory->willReturn(0);

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSiteWithDomain('app.example.com');

        $response = $this->actingAs($user)->delete(route('sites.destroy', $site), [
            'confirmation' => 'wrong-name',
        ]);

        $response->assertRedirect();
        $response->assertSessionHasErrors('confirmation');
        $this->assertDatabaseHas('sites', ['name' => $site->name]);
    }

    public function test_destroy_removes_site_when_confirmed(): void
    {
        $this->processFactory->willReturn(0);

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSiteWithDomain('app.example.com');

        $response = $this->actingAs($user)->delete(route('sites.destroy', $site), [
            'confirmation' => $site->name,
        ]);

        $response->assertRedirect(route('sites.index'));
        $this->assertSoftDeleted('sites', ['name' => $site->name]);
    }

    private function createSiteWithDomain(string $name, bool $strictFunctions = false): Site
    {
        $site = Site::factory()->laravel()->create([
            'server_id' => 1,
            'name' => $name,
            'path' => '/home/beacon/'.$name,
            'strict_functions' => $strictFunctions,
        ]);

        SiteDomain::query()->create([
            'site_id' => $site->id,
            'domain' => $name,
            'is_primary' => true,
        ]);

        return $site;
    }
}
