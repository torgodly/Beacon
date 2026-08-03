<?php

namespace Tests\Feature\Settings;

use App\Models\Server;
use App\Models\User;
use App\Services\System\ProcessFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\Test;
use Tests\Support\FakeProcessFactory;
use Tests\TestCase;

class ServerSettingsTest extends TestCase
{
    use RefreshDatabase;

    private FakeProcessFactory $processFactory;

    protected function setUp(): void
    {
        parent::setUp();

        $this->processFactory = new FakeProcessFactory;
        $this->app->instance(ProcessFactory::class, $this->processFactory);
    }

    #[Test]
    public function verified_users_can_view_server_settings(): void
    {
        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);

        $this->actingAs($user)
            ->get(route('server.edit'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->component('settings/server')
                ->has('panel')
                ->where('panel.can_attach_domain', true));
    }

    #[Test]
    public function attach_panel_domain_updates_server_record(): void
    {
        $this->processFactory->willReturn(0);

        $user = User::factory()->create();
        Server::factory()->create([
            'id' => 1,
            'panel_domain' => null,
            'panel_port' => 8443,
            'panel_url_public' => false,
        ]);

        $this->actingAs($user)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->from(route('server.edit'))
            ->post(route('server.domain.attach'), [
                'domain' => 'panel.example.com',
                'email' => 'admin@example.com',
            ])
            ->assertRedirect(route('server.edit'));

        $server = Server::current();

        $this->assertSame('panel.example.com', $server->panel_domain);
        $this->assertSame(443, $server->panel_port);
        $this->assertTrue($server->panel_url_public);
    }
}
