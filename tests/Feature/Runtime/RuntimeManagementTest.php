<?php

namespace Tests\Feature\Runtime;

use App\Models\NodeVersion;
use App\Models\Server;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RuntimeManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_default_node_version_can_be_set(): void
    {
        $user = User::factory()->create();
        $server = Server::factory()->create(['id' => 1, 'default_node_version' => '20']);

        $runtime = NodeVersion::query()->create([
            'server_id' => $server->id,
            'runtime' => 'node',
            'version' => '22',
            'path' => '/usr/local/node/v22/bin',
            'status' => 'installed',
        ]);

        $response = $this->actingAs($user)->patch(route('runtimes.default', $runtime));

        $response->assertRedirect();
        $this->assertSame('22', $server->fresh()->default_node_version);
        $this->assertTrue($runtime->fresh()->is_default);
    }

    public function test_default_package_manager_can_be_updated(): void
    {
        $user = User::factory()->create();
        $server = Server::factory()->create(['id' => 1, 'default_package_manager' => 'npm']);

        $response = $this->actingAs($user)->patch(route('runtimes.package-manager'), [
            'package_manager' => 'bun',
        ]);

        $response->assertRedirect();
        $this->assertSame('bun', $server->fresh()->default_package_manager);
    }
}
