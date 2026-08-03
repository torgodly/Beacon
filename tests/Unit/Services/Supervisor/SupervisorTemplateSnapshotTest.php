<?php

namespace Tests\Unit\Services\Supervisor;

use App\Models\Server;
use App\Models\Site;
use App\Models\SupervisorProcess;
use App\Services\Supervisor\SupervisorTemplateRenderer;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\AssertsTemplateFixtures;
use Tests\TestCase;

class SupervisorTemplateSnapshotTest extends TestCase
{
    use AssertsTemplateFixtures;
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Server::factory()->create(['id' => 1]);
    }

    public function test_queue_worker_config_matches_fixture(): void
    {
        $site = Site::factory()->laravel()->create([
            'server_id' => 1,
            'name' => 'app.example.com',
            'path' => '/home/beacon/app.example.com',
            'php_version' => '8.4',
        ]);

        $process = SupervisorProcess::factory()->create([
            'site_id' => $site->id,
            'name' => 'queue',
            'program_name' => 'app-example-com-queue',
            'kind' => 'queue_worker',
            'connection' => 'redis',
            'queue' => 'default,high',
            'log_path' => '/var/log/beacon/sites/app.example.com-queue.log',
        ]);

        $output = app(SupervisorTemplateRenderer::class)->render($site, $process);

        $this->assertMatchesTemplateFixture('supervisor/queue-worker.conf', $output);
        $this->assertStringContainsString('[program:app-example-com-queue]', $output);
        $this->assertStringContainsString('user            = beacon', $output);
        $this->assertStringNotContainsString('user=root', $output);
    }

    public function test_ssr_config_matches_fixture(): void
    {
        $site = Site::factory()->nextjs()->create([
            'server_id' => 1,
            'name' => 'spa.example.com',
            'path' => '/home/beacon/spa.example.com',
            'node_version' => '22',
            'proxy_port' => 3001,
        ]);

        $process = SupervisorProcess::factory()->create([
            'site_id' => $site->id,
            'name' => 'ssr',
            'program_name' => 'spa-example-com-ssr',
            'kind' => 'ssr',
            'command' => '/home/beacon/.beacon/bin/spa.example.com-ssr.sh',
            'log_path' => '/var/log/beacon/sites/spa.example.com-ssr.log',
        ]);

        $output = app(SupervisorTemplateRenderer::class)->render($site, $process);

        $this->assertMatchesTemplateFixture('supervisor/ssr.conf', $output);
        $this->assertStringContainsString('spa.example.com-ssr.sh', $output);
    }
}
