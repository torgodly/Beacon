<?php

namespace Tests\Feature\Services;

use App\Models\Server;
use App\Models\User;
use App\Services\System\ProcessFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\FakeProcessFactory;
use Tests\TestCase;

class ServiceControlTest extends TestCase
{
    use RefreshDatabase;

    private FakeProcessFactory $processFactory;

    protected function setUp(): void
    {
        parent::setUp();

        $this->processFactory = new FakeProcessFactory;
        $this->app->instance(ProcessFactory::class, $this->processFactory);
    }

    public function test_services_page_lists_allowed_units(): void
    {
        $this->processFactory->willReturn(0, "active\nrunning\n1234\n");

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);

        $response = $this->actingAs($user)->get(route('services.index'));

        $response->assertOk();
        $response->assertInertia(fn ($page) => $page
            ->component('services/index')
            ->has('services', count(config('beacon.allowed_units')))
        );
    }

    public function test_restart_invokes_beacon_service_wrapper(): void
    {
        $this->processFactory->willReturn(0);

        $user = User::factory()->create();

        $response = $this->actingAs($user)->post(route('services.restart', ['unit' => 'nginx']));

        $response->assertRedirect();
        $this->assertSame(
            ['sudo', '-n', config('beacon.paths.bin').'/beacon-service', 'restart', 'nginx'],
            $this->processFactory->lastCall()['command'],
        );
    }

    public function test_restart_rejects_disallowed_units(): void
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post(route('services.restart', ['unit' => 'ssh']));

        $response->assertRedirect();
        $response->assertSessionHas('toast');
    }
}
