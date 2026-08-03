<?php

namespace Tests\Feature\Settings;

use App\Models\PanelUpdate;
use App\Models\Server;
use App\Models\User;
use App\Services\System\ProcessFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\FakeProcessFactory;
use Tests\TestCase;

class PanelUpdateTest extends TestCase
{
    use RefreshDatabase;

    private FakeProcessFactory $processFactory;

    protected function setUp(): void
    {
        parent::setUp();

        $this->processFactory = new FakeProcessFactory;
        $this->app->instance(ProcessFactory::class, $this->processFactory);
    }

    public function test_panel_update_can_be_queued(): void
    {
        $this->processFactory->willReturn(0, "Deployed v1.0.0\n");

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1, 'beacon_version' => '0.1.0-dev']);

        $response = $this->actingAs($user)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->post(route('updates.store'), [
                'tag' => 'v1.0.0',
            ]);

        $response->assertRedirect(route('updates.edit'));

        $update = PanelUpdate::query()->first();
        $this->assertNotNull($update);
        $this->assertSame('success', $update->status);
        $this->assertSame('v1.0.0', Server::current()->fresh()->beacon_version);
    }

    public function test_rollback_can_be_queued(): void
    {
        $this->processFactory->willReturn(0);

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);

        $response = $this->actingAs($user)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->post(route('updates.rollback'));

        $response->assertRedirect(route('updates.edit'));

        $this->assertDatabaseHas('panel_updates', [
            'action' => 'rollback',
            'status' => 'success',
        ]);
    }

    public function test_invalid_tag_is_rejected(): void
    {
        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);

        $response = $this->actingAs($user)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->post(route('updates.store'), [
                'tag' => 'main',
            ]);

        $response->assertSessionHasErrors('tag');
        $this->assertDatabaseCount('panel_updates', 0);
    }
}
