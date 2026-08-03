<?php

namespace Tests\Feature\Jobs;

use App\Jobs\PollRepositoryHeads;
use App\Models\Deployment;
use App\Models\Server;
use App\Models\Site;
use App\Models\SiteDomain;
use App\Services\Deployment\GitService;
use App\Services\System\ProcessFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\FakeProcessFactory;
use Tests\TestCase;

class PollRepositoryHeadsTest extends TestCase
{
    use RefreshDatabase;

    private FakeProcessFactory $processFactory;

    protected function setUp(): void
    {
        parent::setUp();

        $this->processFactory = new FakeProcessFactory;
        $this->app->instance(ProcessFactory::class, $this->processFactory);
    }

    public function test_queues_deployment_when_remote_head_changes(): void
    {
        $this->processFactory->willReturn(0, "newsha1234567890 refs/heads/main\n");

        Server::factory()->create(['id' => 1]);

        $site = Site::factory()->laravel()->create([
            'server_id' => 1,
            'name' => 'app.example.com',
            'path' => '/home/beacon/app.example.com',
            'repository' => 'git@github.com:acme/app.git',
            'repository_branch' => 'main',
            'auto_deploy' => true,
            'deploy_trigger' => 'poll',
            'last_polled_sha' => 'oldsha1234567890',
        ]);

        SiteDomain::query()->create([
            'site_id' => $site->id,
            'domain' => 'app.example.com',
            'is_primary' => true,
        ]);

        (new PollRepositoryHeads)->handle(app(GitService::class));

        $deployment = Deployment::query()->first();

        $this->assertNotNull($deployment);
        $this->assertSame('poll', $deployment->trigger);
        $this->assertSame('newsha1234567890', $deployment->commit_sha);
        $this->assertSame('newsha1234567890', $site->fresh()->last_polled_sha);
    }

    public function test_does_not_queue_deployment_when_head_is_unchanged(): void
    {
        $this->processFactory->willReturn(0, "same1234567890 refs/heads/main\n");

        Server::factory()->create(['id' => 1]);

        $site = Site::factory()->laravel()->create([
            'server_id' => 1,
            'name' => 'app.example.com',
            'path' => '/home/beacon/app.example.com',
            'repository' => 'git@github.com:acme/app.git',
            'repository_branch' => 'main',
            'auto_deploy' => true,
            'deploy_trigger' => 'poll',
            'last_polled_sha' => 'same1234567890',
        ]);

        SiteDomain::query()->create([
            'site_id' => $site->id,
            'domain' => 'app.example.com',
            'is_primary' => true,
        ]);

        (new PollRepositoryHeads)->handle(app(GitService::class));

        $this->assertSame(0, Deployment::query()->count());
    }
}
