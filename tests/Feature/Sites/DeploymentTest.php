<?php

namespace Tests\Feature\Sites;

use App\Models\Deployment;
use App\Models\Server;
use App\Models\Site;
use App\Models\SiteDomain;
use App\Models\User;
use App\Services\System\ProcessFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\FakeProcessFactory;
use Tests\TestCase;

class DeploymentTest extends TestCase
{
    use RefreshDatabase;

    private FakeProcessFactory $processFactory;

    protected function setUp(): void
    {
        parent::setUp();

        $this->processFactory = new FakeProcessFactory;
        $this->app->instance(ProcessFactory::class, $this->processFactory);
    }

    public function test_manual_deploy_runs_script_and_marks_success(): void
    {
        $this->processFactory->willReturn(0, '', '');

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSiteWithScript('app.example.com');

        $response = $this->actingAs($user)->post(route('sites.deployments.store', $site));

        $response->assertRedirect();

        $deployment = Deployment::query()->first();

        $this->assertNotNull($deployment);
        $this->assertSame('success', $deployment->status);
        $this->assertSame(0, $deployment->exit_code);
        $this->assertFileExists($deployment->log_path);
        $this->assertSame('idle', $site->fresh()->deployment_status);
    }

    public function test_deployment_log_endpoint_returns_incremental_output(): void
    {
        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSiteWithScript('app.example.com');

        $logPath = storage_path('framework/testing/deployments/test.log');
        @mkdir(dirname($logPath), 0755, true);
        file_put_contents($logPath, "line one\n");

        $deployment = Deployment::factory()->create([
            'site_id' => $site->id,
            'status' => 'running',
            'log_path' => $logPath,
        ]);

        $response = $this->actingAs($user)->getJson(
            route('sites.deployments.log', [$site, $deployment]).'?offset=0',
        );

        $response->assertOk();
        $response->assertJsonPath('chunk', "line one\n");
        $response->assertJsonPath('status', 'running');
    }

    public function test_deploy_script_can_be_updated(): void
    {
        $this->processFactory->willReturn(0);

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSiteWithScript('app.example.com');

        $script = "#!/usr/bin/env bash\necho updated\n";

        $response = $this->actingAs($user)->patch(route('sites.deploy-script.update', $site), [
            'deploy_script' => $script,
        ]);

        $response->assertRedirect();
        $this->assertStringContainsString('echo updated', (string) $site->fresh()->deploy_script);
    }

    private function createSiteWithScript(string $name): Site
    {
        $site = Site::factory()->laravel()->create([
            'server_id' => 1,
            'name' => $name,
            'path' => '/home/beacon/'.$name,
            'deploy_script' => "#!/usr/bin/env bash\necho deployed\n",
        ]);

        SiteDomain::query()->create([
            'site_id' => $site->id,
            'domain' => $name,
            'is_primary' => true,
        ]);

        return $site;
    }
}
