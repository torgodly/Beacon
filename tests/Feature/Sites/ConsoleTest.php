<?php

namespace Tests\Feature\Sites;

use App\Models\Server;
use App\Models\Site;
use App\Models\SiteCommand;
use App\Models\SiteDomain;
use App\Models\User;
use App\Services\System\ProcessFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\FakeProcessFactory;
use Tests\TestCase;

class ConsoleTest extends TestCase
{
    use RefreshDatabase;

    private FakeProcessFactory $processFactory;

    protected function setUp(): void
    {
        parent::setUp();

        $this->processFactory = new FakeProcessFactory;
        $this->app->instance(ProcessFactory::class, $this->processFactory);
    }

    public function test_command_runs_and_records_success(): void
    {
        $this->processFactory->willReturn(0, "Beacon\n");

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSite('app.example.com');

        $response = $this->actingAs($user)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->post(route('sites.commands.store', $site), [
                'command' => 'php artisan --version',
            ]);

        $response->assertRedirect();

        $command = SiteCommand::query()->first();

        $this->assertNotNull($command);
        $this->assertSame('success', $command->status);
        $this->assertSame(0, $command->exit_code);
    }

    public function test_command_log_endpoint_returns_incremental_output(): void
    {
        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSite('app.example.com');

        $logPath = storage_path('framework/testing/commands/test.log');
        @mkdir(dirname($logPath), 0755, true);
        file_put_contents($logPath, "hello\n");

        $command = SiteCommand::query()->create([
            'site_id' => $site->id,
            'user_id' => $user->id,
            'command' => 'echo hello',
            'status' => 'running',
            'log_path' => $logPath,
        ]);

        $response = $this->actingAs($user)->getJson(
            route('sites.commands.log', [$site, $command]).'?offset=0',
        );

        $response->assertOk();
        $response->assertJsonPath('chunk', "hello\n");
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
