<?php

namespace Tests\Feature\Security;

use App\Models\Server;
use App\Models\Site;
use App\Models\SiteDomain;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RequireRecentPasswordTest extends TestCase
{
    use RefreshDatabase;

    public function test_console_tab_requires_password_confirmation_before_loading(): void
    {
        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSite('app.example.com');

        $this->actingAs($user)
            ->get(route('sites.show', ['site' => $site->name, 'tab' => 'console']))
            ->assertRedirect(route('password.confirm'));
    }

    public function test_overview_tab_does_not_require_password_confirmation(): void
    {
        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSite('app.example.com');

        $this->actingAs($user)
            ->get(route('sites.show', ['site' => $site->name, 'tab' => 'overview']))
            ->assertOk();
    }

    public function test_inertia_command_post_stores_referer_as_intended_url(): void
    {
        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSite('app.example.com');

        $consoleUrl = route('sites.show', ['site' => $site->name, 'tab' => 'console']);

        $this->actingAs($user)
            ->withHeader('Referer', $consoleUrl)
            ->withHeader('X-Inertia', 'true')
            ->post(route('sites.commands.store', $site), [
                'command' => 'php artisan --version',
            ])
            ->assertRedirect(route('password.confirm'))
            ->assertSessionHas('url.intended', $consoleUrl);
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
