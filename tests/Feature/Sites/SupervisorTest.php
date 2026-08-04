<?php

namespace Tests\Feature\Sites;

use App\Models\Server;
use App\Models\Site;
use App\Models\SiteDomain;
use App\Models\SupervisorProcess;
use App\Models\User;
use App\Services\System\ProcessFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\FakeProcessFactory;
use Tests\TestCase;

class SupervisorTest extends TestCase
{
    use RefreshDatabase;

    private FakeProcessFactory $processFactory;

    protected function setUp(): void
    {
        parent::setUp();

        $this->processFactory = new FakeProcessFactory;
        $this->app->instance(ProcessFactory::class, $this->processFactory);
    }

    public function test_queue_worker_can_be_created(): void
    {
        $this->processFactory->willReturn(0, "example-com-queue RUNNING pid 1\n");

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSite('app.example.com');

        $response = $this->actingAs($user)->post(route('sites.supervisor.store', $site), [
            'name' => 'queue',
            'queue' => 'default',
        ]);

        $response->assertRedirect();

        $this->assertDatabaseHas('supervisor_processes', [
            'site_id' => $site->id,
            'name' => 'queue',
            'queue' => 'default',
        ]);
    }

    public function test_supervisor_process_can_be_deleted(): void
    {
        $this->processFactory->willReturn(0);

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSite('app.example.com');
        $process = SupervisorProcess::factory()->create([
            'site_id' => $site->id,
            'program_name' => 'app-example-com-queue',
        ]);

        $response = $this->actingAs($user)->delete(
            route('sites.supervisor.destroy', [$site, $process]),
        );

        $response->assertRedirect();
        $this->assertDatabaseMissing('supervisor_processes', ['id' => $process->id]);
    }

    public function test_custom_background_process_can_be_created(): void
    {
        $this->processFactory->willReturn(0, "example-com-worker RUNNING pid 1\n");

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSite('app.example.com');

        $response = $this->actingAs($user)->post(route('sites.supervisor.store', $site), [
            'kind' => 'custom',
            'name' => 'worker',
            'command' => 'php artisan horizon',
        ]);

        $response->assertRedirect();

        $this->assertDatabaseHas('supervisor_processes', [
            'site_id' => $site->id,
            'name' => 'worker',
            'kind' => 'custom',
            'command' => 'php artisan horizon',
        ]);
    }

    private function createSite(string $name): Site
    {
        $site = Site::factory()->laravel()->create([
            'server_id' => 1,
            'name' => $name,
            'path' => '/home/beacon/'.$name,
            'php_version' => '8.4',
        ]);

        SiteDomain::query()->create([
            'site_id' => $site->id,
            'domain' => $name,
            'is_primary' => true,
        ]);

        return $site;
    }
}
