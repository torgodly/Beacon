<?php

namespace Tests\Feature\Sites;

use App\Models\CronJob;
use App\Models\Server;
use App\Models\Site;
use App\Models\SiteDomain;
use App\Models\User;
use App\Services\System\ProcessFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\FakeProcessFactory;
use Tests\TestCase;

class CronTest extends TestCase
{
    use RefreshDatabase;

    private FakeProcessFactory $processFactory;

    protected function setUp(): void
    {
        parent::setUp();

        $this->processFactory = new FakeProcessFactory;
        $this->app->instance(ProcessFactory::class, $this->processFactory);
    }

    public function test_laravel_scheduler_can_be_enabled(): void
    {
        $this->processFactory->willReturn(0, '');

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSite('app.example.com');

        $response = $this->actingAs($user)->post(route('sites.cron.scheduler', $site), [
            'enabled' => true,
        ]);

        $response->assertRedirect();

        $this->assertDatabaseHas('cron_jobs', [
            'site_id' => $site->id,
            'is_laravel_scheduler' => true,
            'enabled' => true,
        ]);
    }

    public function test_custom_cron_job_can_be_created(): void
    {
        $this->processFactory->willReturn(0, '');

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSite('app.example.com');

        $response = $this->actingAs($user)->post(route('sites.cron.store', $site), [
            'name' => 'Backup',
            'expression' => '0 3 * * *',
            'command' => 'cd /home/beacon/app.example.com && php artisan backup:run',
        ]);

        $response->assertRedirect();

        $this->assertDatabaseHas('cron_jobs', [
            'site_id' => $site->id,
            'name' => 'Backup',
        ]);
    }

    public function test_custom_cron_job_can_be_deleted(): void
    {
        $this->processFactory->willReturn(0, '');

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSite('app.example.com');
        $job = CronJob::query()->create([
            'server_id' => 1,
            'site_id' => $site->id,
            'name' => 'Backup',
            'command' => 'echo backup',
            'run_as' => 'beacon',
            'expression' => '0 3 * * *',
            'enabled' => true,
        ]);

        $response = $this->actingAs($user)->delete(
            route('sites.cron.destroy', [$site, $job]),
        );

        $response->assertRedirect();
        $this->assertDatabaseMissing('cron_jobs', ['id' => $job->id]);
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
