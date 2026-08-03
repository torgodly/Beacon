<?php

namespace Tests\Feature\Sites;

use App\Models\NodeVersion;
use App\Models\PhpVersion;
use App\Models\Server;
use App\Models\Site;
use App\Models\SiteDomain;
use App\Models\User;
use App\Services\System\ProcessFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\FakeProcessFactory;
use Tests\TestCase;

class SiteRuntimeTest extends TestCase
{
    use RefreshDatabase;

    private FakeProcessFactory $processFactory;

    protected function setUp(): void
    {
        parent::setUp();

        $this->processFactory = new FakeProcessFactory;
        $this->app->instance(ProcessFactory::class, $this->processFactory);
    }

    public function test_update_changes_php_and_node_versions(): void
    {
        $this->processFactory->willReturn(0);

        $user = User::factory()->create();
        $server = Server::factory()->create(['id' => 1]);
        PhpVersion::factory()->create([
            'server_id' => $server->id,
            'version' => '8.3',
        ]);
        PhpVersion::factory()->create([
            'server_id' => $server->id,
            'version' => '8.4',
        ]);
        NodeVersion::factory()->create([
            'server_id' => $server->id,
            'runtime' => 'node',
            'version' => '22',
        ]);
        NodeVersion::factory()->create([
            'server_id' => $server->id,
            'runtime' => 'node',
            'version' => '24',
        ]);

        $site = Site::factory()->laravel()->create([
            'server_id' => $server->id,
            'name' => 'app.example.com',
            'path' => '/home/beacon/app.example.com',
            'php_version' => '8.3',
            'node_version' => '22',
        ]);

        SiteDomain::query()->create([
            'site_id' => $site->id,
            'domain' => 'app.example.com',
            'is_primary' => true,
        ]);

        $response = $this->actingAs($user)->patch(route('sites.runtime.update', $site), [
            'php_version' => '8.4',
            'node_version' => '24',
        ]);

        $response->assertRedirect();

        $site->refresh();

        $this->assertSame('8.4', $site->php_version);
        $this->assertSame('24', $site->node_version);
    }

    public function test_settings_tab_includes_runtime_options(): void
    {
        $user = User::factory()->create();
        $server = Server::factory()->create(['id' => 1]);
        PhpVersion::factory()->create([
            'server_id' => $server->id,
            'version' => '8.4',
        ]);
        NodeVersion::factory()->create([
            'server_id' => $server->id,
            'runtime' => 'node',
            'version' => '22',
        ]);

        $site = Site::factory()->laravel()->create([
            'server_id' => $server->id,
            'name' => 'app.example.com',
            'path' => '/home/beacon/app.example.com',
        ]);

        SiteDomain::query()->create([
            'site_id' => $site->id,
            'domain' => 'app.example.com',
            'is_primary' => true,
        ]);

        $this->actingAs($user)
            ->get(route('sites.show', ['site' => $site, 'tab' => 'settings']))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('sites/show')
                ->where('tab', 'settings')
                ->has('runtimeOptions.php_versions', 1)
                ->has('runtimeOptions.node_versions', 1));
    }
}
