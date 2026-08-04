<?php

namespace Tests\Feature\Sites;

use App\Models\PhpVersion;
use App\Models\Server;
use App\Models\Site;
use App\Models\SiteDomain;
use App\Models\User;
use App\Services\Database\MySqlService;
use App\Services\System\ProcessFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
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
            'app_env' => 'production',
            'database_driver' => 'mysql',
            'database_strategy' => 'none',
        ]);

        $response->assertRedirect(route('sites.index'));

        $this->assertDatabaseHas('sites', [
            'name' => 'app.example.com',
            'type' => 'laravel',
            'php_version' => '8.4',
            'app_env' => 'production',
            'database_driver' => 'mysql',
            'status' => 'active',
        ]);

        $this->assertDatabaseHas('site_domains', [
            'domain' => 'app.example.com',
            'is_primary' => true,
        ]);
    }

    public function test_store_can_provision_a_mysql_database_for_laravel_sites(): void
    {
        $this->processFactory->willReturn(0, "server { listen 80; }\n");

        $this->mock(MySqlService::class, function (MockInterface $mock): void {
            $mock->shouldReceive('createDatabase')->once()->with('app_example_com');
            $mock->shouldReceive('createUser')->once();
            $mock->shouldReceive('grant')->once()->with('app_example_com_user', 'app_example_com', 'all');
        });

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $this->installPhp('8.4');

        $response = $this->actingAs($user)->post(route('sites.store'), [
            'name' => 'app.example.com',
            'type' => 'laravel',
            'php_version' => '8.4',
            'app_env' => 'staging',
            'database_driver' => 'mysql',
            'database_strategy' => 'create',
            'database_name' => 'app_example_com',
        ]);

        $response->assertRedirect(route('sites.index'));

        $this->assertDatabaseHas('databases', [
            'name' => 'app_example_com',
            'status' => 'active',
        ]);

        $site = Site::query()->where('name', 'app.example.com')->firstOrFail();

        $this->assertNotNull($site->database_id);
        $this->assertNotNull($site->database_user_id);
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
            'app_env' => 'production',
            'database_driver' => 'mysql',
            'database_strategy' => 'none',
            'repository' => 'git@github.com:org/app.git',
            'repository_branch' => 'main',
        ]);

        $response->assertRedirect(route('sites.index'));

        $this->assertDatabaseHas('sites', [
            'name' => 'app.example.com',
            'repository' => 'git@github.com:org/app.git',
            'repository_branch' => 'main',
            'repository_provider' => 'custom',
        ]);
    }

    public function test_store_rejects_an_invalid_hostname(): void
    {
        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $this->installPhp('8.4');

        $response = $this->actingAs($user)->post(route('sites.store'), [
            'name' => 'Domain',
            'type' => 'laravel',
            'php_version' => '8.4',
            'app_env' => 'production',
            'database_driver' => 'mysql',
            'database_strategy' => 'none',
        ]);

        $response->assertSessionHasErrors('name');
        $this->assertDatabaseMissing('sites', ['name' => 'Domain']);
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
            'database_strategy' => 'none',
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

    public function test_the_panel_hostname_cannot_be_used_as_a_site_name(): void
    {
        $user = User::factory()->create();
        Server::factory()->create([
            'id' => 1,
            'panel_domain' => 'beacon.abdo.ly',
        ]);
        $this->installPhp('8.4');

        $response = $this->actingAs($user)->post(route('sites.store'), [
            'name' => 'beacon.abdo.ly',
            'type' => 'laravel',
            'php_version' => '8.4',
            'app_env' => 'production',
            'database_driver' => 'mysql',
            'database_strategy' => 'none',
        ]);

        $response->assertSessionHasErrors('name');
        $this->assertDatabaseMissing('sites', ['name' => 'beacon.abdo.ly']);
    }

    public function test_a_hostname_that_collides_with_a_reserved_fpm_pool_is_rejected(): void
    {
        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $this->installPhp('8.4');

        $response = $this->actingAs($user)->post(route('sites.store'), [
            'name' => 'beacon.panel',
            'type' => 'laravel',
            'php_version' => '8.4',
            'app_env' => 'production',
            'database_driver' => 'mysql',
            'database_strategy' => 'none',
        ]);

        $response->assertSessionHasErrors('name');
        $this->assertDatabaseMissing('sites', ['name' => 'beacon.panel']);
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

    public function test_store_can_create_a_laravel_site_with_sqlite(): void
    {
        $this->processFactory->willReturn(0, "server { listen 80; }\n");

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $this->installPhp('8.4');

        $response = $this->actingAs($user)->post(route('sites.store'), [
            'name' => 'sqlite.example.com',
            'type' => 'laravel',
            'php_version' => '8.4',
            'app_env' => 'testing',
            'database_driver' => 'sqlite',
            'redis_enabled' => false,
        ]);

        $response->assertRedirect(route('sites.index'));

        $this->assertDatabaseHas('sites', [
            'name' => 'sqlite.example.com',
            'app_env' => 'testing',
            'database_driver' => 'sqlite',
            'database_id' => null,
            'database_user_id' => null,
            'redis_enabled' => false,
        ]);
    }

    public function test_store_can_enable_redis_for_laravel_sites(): void
    {
        $this->processFactory->willReturn(0, "server { listen 80; }\n");

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $this->installPhp('8.4');

        $response = $this->actingAs($user)->post(route('sites.store'), [
            'name' => 'redis.example.com',
            'type' => 'laravel',
            'php_version' => '8.4',
            'app_env' => 'production',
            'database_driver' => 'mysql',
            'database_strategy' => 'none',
            'redis_enabled' => true,
        ]);

        $response->assertRedirect(route('sites.index'));

        $this->assertDatabaseHas('sites', [
            'name' => 'redis.example.com',
            'redis_enabled' => true,
        ]);
    }

    public function test_store_can_enable_auto_deploy_with_a_custom_repository(): void
    {
        $this->processFactory->willReturn(0, "server { listen 80; }\n");

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $this->installPhp('8.4');

        $response = $this->actingAs($user)->post(route('sites.store'), [
            'name' => 'deploy.example.com',
            'type' => 'laravel',
            'php_version' => '8.4',
            'app_env' => 'production',
            'database_driver' => 'mysql',
            'database_strategy' => 'none',
            'repository' => 'git@github.com:org/app.git',
            'repository_branch' => 'main',
            'auto_deploy' => true,
        ]);

        $response->assertRedirect(route('sites.index'));

        $this->assertDatabaseHas('sites', [
            'name' => 'deploy.example.com',
            'auto_deploy' => true,
            'deploy_trigger' => 'poll',
        ]);
    }

    public function test_store_disables_auto_deploy_when_no_repository_is_connected(): void
    {
        $this->processFactory->willReturn(0, "server { listen 80; }\n");

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $this->installPhp('8.4');

        $response = $this->actingAs($user)->post(route('sites.store'), [
            'name' => 'manual.example.com',
            'type' => 'laravel',
            'php_version' => '8.4',
            'app_env' => 'production',
            'database_driver' => 'mysql',
            'database_strategy' => 'none',
            'auto_deploy' => true,
        ]);

        $response->assertRedirect(route('sites.index'));

        $this->assertDatabaseHas('sites', [
            'name' => 'manual.example.com',
            'auto_deploy' => false,
            'deploy_trigger' => 'manual',
        ]);
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
