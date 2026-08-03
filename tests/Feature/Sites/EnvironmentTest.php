<?php

namespace Tests\Feature\Sites;

use App\Models\EnvSnapshot;
use App\Models\Server;
use App\Models\Site;
use App\Models\SiteDomain;
use App\Models\User;
use App\Services\System\ProcessFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\FakeProcessFactory;
use Tests\TestCase;

class EnvironmentTest extends TestCase
{
    use RefreshDatabase;

    private FakeProcessFactory $processFactory;

    protected function setUp(): void
    {
        parent::setUp();

        $this->processFactory = new FakeProcessFactory;
        $this->app->instance(ProcessFactory::class, $this->processFactory);
    }

    public function test_environment_file_can_be_updated(): void
    {
        $this->processFactory->willReturn(0, 'APP_NAME=Beacon');

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSite('app.example.com');

        $response = $this->actingAs($user)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->patch(route('sites.environment.update', $site), [
                'contents' => "APP_NAME=Updated\nAPP_ENV=local\n",
            ]);

        $response->assertRedirect();

        $writeCall = collect($this->processFactory->calls)->first(
            fn (array $call): bool => str_contains((string) $call['input'], '"action":"write"'),
        );

        $this->assertNotNull($writeCall);
        $this->assertDatabaseHas('env_snapshots', [
            'site_id' => $site->id,
            'user_id' => $user->id,
        ]);
    }

    public function test_environment_snapshot_can_be_restored(): void
    {
        $this->processFactory->willReturn(0, '');

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSite('app.example.com');
        $snapshot = EnvSnapshot::query()->create([
            'site_id' => $site->id,
            'user_id' => $user->id,
            'contents' => "APP_NAME=Restored\n",
        ]);

        $response = $this->actingAs($user)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->post(
                route('sites.environment.restore', [$site, $snapshot]),
            );

        $response->assertRedirect();
    }

    private function createSite(string $name): Site
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
