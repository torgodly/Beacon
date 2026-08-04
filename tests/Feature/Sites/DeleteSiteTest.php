<?php

namespace Tests\Feature\Sites;

use App\Models\ActivityLog;
use App\Models\CronJob;
use App\Models\Deployment;
use App\Models\Server;
use App\Models\Site;
use App\Models\SiteCommand;
use App\Models\SiteDomain;
use App\Models\SupervisorProcess;
use App\Models\User;
use App\Services\System\ProcessFactory;
use App\Services\System\SudoWrapper;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Str;
use Tests\Support\FakeProcessFactory;
use Tests\TestCase;

class DeleteSiteTest extends TestCase
{
    use RefreshDatabase;

    private FakeProcessFactory $processFactory;

    protected function setUp(): void
    {
        parent::setUp();

        $this->processFactory = new FakeProcessFactory;
        $this->processFactory->willReturn(0);
        $this->app->instance(ProcessFactory::class, $this->processFactory);
    }

    public function test_destroy_hard_deletes_site_and_related_records(): void
    {
        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSite('app.example.com');

        $deployment = Deployment::factory()->create(['site_id' => $site->id]);
        $site->update(['last_deployment_id' => $deployment->id]);

        SiteCommand::query()->create([
            'uuid' => (string) Str::uuid(),
            'site_id' => $site->id,
            'user_id' => $user->id,
            'command' => 'php artisan inspire',
            'status' => 'success',
            'log_path' => storage_path('framework/testing/commands/app.log'),
        ]);

        SupervisorProcess::factory()->create([
            'site_id' => $site->id,
            'kind' => 'queue_worker',
        ]);

        CronJob::query()->create([
            'server_id' => 1,
            'site_id' => $site->id,
            'name' => 'Nightly',
            'command' => 'echo nightly',
            'expression' => '0 0 * * *',
        ]);

        ActivityLog::factory()->create([
            'subject_type' => Site::class,
            'subject_id' => $site->id,
            'event' => 'site.created',
        ]);

        $response = $this->actingAs($user)->delete(route('sites.destroy', $site), [
            'confirmation' => $site->name,
        ]);

        $response->assertRedirect(route('sites.index'));
        $this->assertDatabaseMissing('sites', ['name' => $site->name]);
        $this->assertDatabaseMissing('site_domains', ['site_id' => $site->id]);
        $this->assertDatabaseMissing('deployments', ['site_id' => $site->id]);
        $this->assertDatabaseMissing('commands', ['site_id' => $site->id]);
        $this->assertDatabaseMissing('supervisor_processes', ['site_id' => $site->id]);
        $this->assertDatabaseMissing('cron_jobs', ['site_id' => $site->id]);
        $this->assertDatabaseMissing('activity_logs', [
            'subject_type' => Site::class,
            'subject_id' => $site->id,
        ]);
    }

    public function test_destroy_removes_supervisor_programs_and_syncs_cron(): void
    {
        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSite('app.example.com');

        SupervisorProcess::factory()->create([
            'site_id' => $site->id,
            'program_name' => 'app-example-com-queue',
        ]);

        CronJob::query()->create([
            'server_id' => 1,
            'site_id' => $site->id,
            'name' => 'Nightly',
            'command' => 'echo nightly',
            'expression' => '0 0 * * *',
        ]);

        $this->actingAs($user)->delete(route('sites.destroy', $site), [
            'confirmation' => $site->name,
        ])->assertRedirect(route('sites.index'));

        $supervisorDelete = collect($this->processFactory->calls)->first(
            fn (array $call): bool => ($call['command'][2] ?? '') === SudoWrapper::Supervisor->path()
                && ($call['command'][3] ?? '') === 'delete',
        );

        $this->assertNotNull($supervisorDelete);

        $cronWrite = collect($this->processFactory->calls)->first(
            fn (array $call): bool => ($call['command'][2] ?? '') === SudoWrapper::Cron->path()
                && ($call['command'][3] ?? '') === 'write',
        );

        $this->assertNotNull($cronWrite);
    }

    public function test_destroy_deletes_deployment_log_files(): void
    {
        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSite('app.example.com');

        $logPath = storage_path('framework/testing/deployments/delete-me.log');
        File::ensureDirectoryExists(dirname($logPath));
        File::put($logPath, "deploy output\n");

        Deployment::factory()->create([
            'site_id' => $site->id,
            'log_path' => $logPath,
        ]);

        $this->actingAs($user)->delete(route('sites.destroy', $site), [
            'confirmation' => $site->name,
        ])->assertRedirect(route('sites.index'));

        $this->assertFileDoesNotExist($logPath);
    }

    public function test_destroy_blocks_while_deployment_is_running(): void
    {
        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSite('app.example.com');
        $site->update(['deployment_status' => 'running']);

        $response = $this->actingAs($user)->delete(route('sites.destroy', $site), [
            'confirmation' => $site->name,
        ]);

        $response->assertRedirect();
        $response->assertSessionHasErrors('confirmation');
        $this->assertDatabaseHas('sites', ['name' => $site->name]);
    }

    private function createSite(string $name): Site
    {
        $site = Site::factory()->laravel()->create([
            'server_id' => 1,
            'name' => $name,
            'path' => '/home/beacon/'.$name,
            'deploy_key_path' => '/home/beacon/.ssh/id_ed25519_'.$name,
        ]);

        SiteDomain::query()->create([
            'site_id' => $site->id,
            'domain' => $name,
            'is_primary' => true,
        ]);

        return $site;
    }
}
