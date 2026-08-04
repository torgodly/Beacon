<?php

namespace Tests\Feature\Sites;

use App\Models\GithubInstallation;
use App\Models\Server;
use App\Models\User;
use App\Services\Github\GitHubAppClient;
use App\Services\System\ProcessFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Tests\Support\FakeProcessFactory;
use Tests\TestCase;

class GitHubBrowseTest extends TestCase
{
    use RefreshDatabase;

    private FakeProcessFactory $processFactory;

    protected function setUp(): void
    {
        parent::setUp();

        $this->processFactory = new FakeProcessFactory;
        $this->app->instance(ProcessFactory::class, $this->processFactory);
    }

    public function test_remote_branches_lists_heads_from_git_ls_remote(): void
    {
        $this->processFactory->willReturn(
            0,
            "abc123\trefs/heads/main\nabc456\trefs/heads/develop\n",
        );

        $user = User::factory()->create();

        $response = $this->actingAs($user)->getJson(route('github.remote-branches', [
            'repository' => 'org/app',
        ]));

        $response->assertOk();
        $response->assertJsonPath('branches.0.name', 'develop');
        $response->assertJsonPath('branches.1.name', 'main');
    }

    public function test_github_repositories_requires_a_connected_installation(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->getJson(route('github.repositories'))
            ->assertNotFound();
    }

    public function test_github_repositories_returns_installation_repositories(): void
    {
        $user = User::factory()->create();
        GithubInstallation::factory()->create([
            'user_id' => $user->id,
            'installation_id' => 12345,
        ]);

        $client = Mockery::mock(GitHubAppClient::class);
        $client->shouldReceive('listRepositories')
            ->once()
            ->andReturn([
                [
                    'id' => 1,
                    'full_name' => 'acme/app',
                    'clone_url' => 'https://github.com/acme/app.git',
                    'ssh_url' => 'git@github.com:acme/app.git',
                    'default_branch' => 'main',
                ],
            ]);
        $this->app->instance(GitHubAppClient::class, $client);

        $response = $this->actingAs($user)->getJson(route('github.repositories'));

        $response->assertOk();
        $response->assertJsonPath('repositories.0.full_name', 'acme/app');
    }

    public function test_sites_index_includes_github_connection_state(): void
    {
        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        GithubInstallation::factory()->create([
            'user_id' => $user->id,
            'installation_id' => 12345,
        ]);

        $this->actingAs($user)
            ->get(route('sites.index'))
            ->assertOk()
            ->assertInertia(fn ($page) => $page
                ->where('github.connected', true));
    }
}
