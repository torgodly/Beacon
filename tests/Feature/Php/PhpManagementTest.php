<?php

namespace Tests\Feature\Php;

use App\Models\PhpExtension;
use App\Models\PhpVersion;
use App\Models\Server;
use App\Models\User;
use App\Services\System\ProcessFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\FakeProcessFactory;
use Tests\TestCase;

class PhpManagementTest extends TestCase
{
    use RefreshDatabase;

    private FakeProcessFactory $processFactory;

    protected function setUp(): void
    {
        parent::setUp();

        $this->processFactory = new FakeProcessFactory;
        $this->app->instance(ProcessFactory::class, $this->processFactory);
    }

    public function test_php_install_queues_and_completes(): void
    {
        $this->processFactory->willReturn(0);

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);

        $response = $this->actingAs($user)->post(route('php.install', ['version' => '8.4']));

        $response->assertRedirect();

        $this->assertDatabaseHas('php_versions', [
            'server_id' => 1,
            'version' => '8.4',
            'status' => 'installed',
        ]);
    }

    public function test_extension_can_be_enabled(): void
    {
        $this->processFactory->willReturn(0);

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);

        $phpVersion = PhpVersion::factory()->create([
            'server_id' => 1,
            'version' => '8.4',
            'status' => 'installed',
        ]);

        $extension = PhpExtension::query()->create([
            'php_version_id' => $phpVersion->id,
            'name' => 'redis',
            'label' => 'redis',
            'apt_package' => 'php8.4-redis',
            'is_installed' => true,
            'is_enabled' => false,
            'is_core' => false,
        ]);

        $response = $this->actingAs($user)->post(route('php.extensions.enable', [
            'phpVersion' => $phpVersion,
            'extension' => $extension,
        ]));

        $response->assertRedirect();
        $this->assertTrue($extension->fresh()->is_enabled);
    }

    public function test_php_ini_can_be_saved(): void
    {
        $this->processFactory->willReturn(0);

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);

        $phpVersion = PhpVersion::factory()->create([
            'server_id' => 1,
            'version' => '8.4',
            'status' => 'installed',
        ]);

        $response = $this->actingAs($user)->patch(route('php.ini.update', $phpVersion), [
            'sapi' => 'fpm',
            'settings' => [
                'memory_limit' => '512M',
                'upload_max_filesize' => '128M',
                'post_max_size' => '128M',
                'max_execution_time' => '120',
            ],
        ]);

        $response->assertRedirect();

        $this->assertDatabaseHas('php_settings', [
            'php_version_id' => $phpVersion->id,
            'sapi' => 'fpm',
            'key' => 'memory_limit',
            'value' => '512M',
        ]);
    }
}
