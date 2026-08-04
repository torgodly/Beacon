<?php

namespace Tests\Feature\Sites;

use App\Models\PhpVersion;
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
        $this->installPhp('8.4');

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

    public function test_store_persists_an_optional_repository(): void
    {
        $this->processFactory->willReturn(0, "server { listen 80; }\n");

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $this->installPhp('8.4');

        $response = $this->actingAs($user)->post(route('sites.store'), [
            'name' => 'app.example.com',
            'type' => 'laravel',
            'php_version' => '8.4',
            'repository' => 'git@github.com:org/app.git',
            'repository_branch' => 'main',
        ]);

        $response->assertRedirect(route('sites.show', 'app.example.com').'?tab=overview');

        $this->assertDatabaseHas('sites', [
            'name' => 'app.example.com',
            'repository' => 'git@github.com:org/app.git',
            'repository_branch' => 'main',
            'repository_provider' => 'custom',
        ]);
    }

    public function test_a_php_version_that_is_not_installed_is_rejected(): void
    {
        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $this->installPhp('8.3');

        $response = $this->actingAs($user)->post(route('sites.store'), [
            'name' => 'app.example.com',
            'type' => 'laravel',
            'php_version' => '8.4', // supported, but not installed here
        ]);

        $response->assertSessionHasErrors('php_version');
        $this->assertDatabaseMissing('sites', ['name' => 'app.example.com']);
    }

    public function test_static_sites_may_not_be_given_a_php_version(): void
    {
        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $this->installPhp('8.4');

        // A static site has no FPM pool, so the field is prohibited rather
        // than quietly accepted and discarded.
        $response = $this->actingAs($user)->post(route('sites.store'), [
            'name' => 'spa.example.com',
            'type' => 'static',
            'php_version' => '8.4',
        ]);

        $response->assertSessionHasErrors('php_version');
        $this->assertDatabaseMissing('sites', ['name' => 'spa.example.com']);
    }

    public function test_index_only_offers_installed_runtimes(): void
    {
        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $this->installPhp('8.3');
        $this->installPhp('8.4', status: 'installing');

        $response = $this->actingAs($user)->get(route('sites.index'));

        $response->assertInertia(fn ($page) => $page
            ->component('sites/index')
            // 8.4 is still installing, so it must not be selectable.
            ->has('phpVersions', 1)
            ->where('phpVersions.0.value', '8.3')
            ->has('nodeVersions')
        );
    }

    private function installPhp(string $version, string $status = 'installed'): void
    {
        PhpVersion::query()->create([
            'server_id' => 1,
            'version' => $version,
            'status' => $status,
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
        $this->assertDatabaseMissing('sites', ['name' => $site->name]);
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
