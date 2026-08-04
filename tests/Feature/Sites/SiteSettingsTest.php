<?php

namespace Tests\Feature\Sites;

use App\Models\GithubInstallation;
use App\Models\Server;
use App\Models\Site;
use App\Models\SiteDomain;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SiteSettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_update_persists_repository_settings(): void
    {
        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSiteWithDomain('app.example.com');

        $response = $this->actingAs($user)->patch(route('sites.settings.update', $site), [
            'repository' => 'git@github.com:acme/app.git',
            'repository_branch' => 'main',
            'repository_provider' => 'custom',
            'auto_deploy' => true,
            'deploy_trigger' => 'poll',
        ]);

        $response->assertRedirect();

        $site->refresh();

        $this->assertSame('git@github.com:acme/app.git', $site->repository);
        $this->assertSame('main', $site->repository_branch);
        $this->assertTrue($site->auto_deploy);
        $this->assertSame('poll', $site->deploy_trigger);
    }

    public function test_update_persists_poll_interval_override(): void
    {
        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSiteWithDomain('poll.example.com');

        $this->actingAs($user)->patch(route('sites.settings.update', $site), [
            'repository' => 'git@github.com:acme/app.git',
            'repository_branch' => 'main',
            'repository_provider' => 'custom',
            'auto_deploy' => true,
            'deploy_trigger' => 'poll',
            'poll_interval_seconds' => 120,
        ])->assertRedirect();

        $this->assertSame(120, $site->fresh()->poll_interval_seconds);
    }

    public function test_update_shows_success_toast_in_inertia_flash(): void
    {
        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSiteWithDomain('toast.example.com');

        $this->actingAs($user)
            ->from(route('sites.show', ['site' => $site, 'tab' => 'settings']))
            ->patch(route('sites.settings.update', $site), [
                'repository' => 'git@github.com:acme/app.git',
                'repository_branch' => 'main',
                'repository_provider' => 'custom',
                'auto_deploy' => false,
                'deploy_trigger' => 'manual',
            ])
            ->assertRedirect();

        $this->actingAs($user)
            ->get(route('sites.show', ['site' => $site, 'tab' => 'settings']))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('flash.toast.type', 'success')
                ->where('flash.toast.message', 'Site settings saved.'));
    }

    public function test_clearing_repository_disables_auto_deploy(): void
    {
        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = Site::factory()->laravel()->create([
            'server_id' => 1,
            'name' => 'app.example.com',
            'path' => '/home/beacon/app.example.com',
            'repository' => 'git@github.com:acme/app.git',
            'auto_deploy' => true,
            'deploy_trigger' => 'poll',
        ]);

        SiteDomain::query()->create([
            'site_id' => $site->id,
            'domain' => 'app.example.com',
            'is_primary' => true,
        ]);

        $response = $this->actingAs($user)->patch(route('sites.settings.update', $site), [
            'repository' => '',
            'repository_branch' => 'main',
            'repository_provider' => 'custom',
            'auto_deploy' => true,
            'deploy_trigger' => 'poll',
        ]);

        $response->assertRedirect();

        $site->refresh();

        $this->assertNull($site->repository);
        $this->assertFalse($site->auto_deploy);
        $this->assertSame('manual', $site->deploy_trigger);
    }

    public function test_github_repository_selection_links_installation(): void
    {
        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $installation = GithubInstallation::factory()->installed()->create([
            'user_id' => $user->id,
        ]);
        $site = $this->createSiteWithDomain('github.example.com');

        $response = $this->actingAs($user)->patch(route('sites.settings.update', $site), [
            'github_repo_id' => 123456,
            'github_repository' => 'acme/app',
            'repository_branch' => 'main',
            'auto_deploy' => true,
            'deploy_trigger' => 'webhook',
        ]);

        $response->assertRedirect();

        $site->refresh();

        $this->assertSame($installation->id, $site->github_installation_id);
        $this->assertSame(123456, $site->github_repo_id);
        $this->assertSame('acme/app', $site->repository);
        $this->assertSame('github', $site->repository_provider);
    }

    private function createSiteWithDomain(string $name): Site
    {
        $site = Site::factory()->laravel()->create([
            'server_id' => 1,
            'name' => $name,
            'path' => '/home/beacon/'.$name,
        ]);

        SiteDomain::query()->create([
            'site_id' => $site->id,
            'domain' => $name,
            'is_primary' => true,
        ]);

        return $site;
    }
}
