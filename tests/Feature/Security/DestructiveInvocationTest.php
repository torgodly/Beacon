<?php

namespace Tests\Feature\Security;

use App\Models\Database;
use App\Models\Server;
use App\Models\Site;
use App\Models\SiteDomain;
use App\Models\User;
use App\Services\System\ProcessFactory;
use App\Services\System\ProcessRunner;
use App\Services\System\SudoWrapper;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\FakeProcessFactory;
use Tests\TestCase;

class DestructiveInvocationTest extends TestCase
{
    use RefreshDatabase;

    private FakeProcessFactory $processFactory;

    protected function setUp(): void
    {
        parent::setUp();

        $this->processFactory = new FakeProcessFactory;
        $this->app->instance(ProcessFactory::class, $this->processFactory);
    }

    public function test_nginx_save_sends_config_on_stdin_to_beacon_nginx(): void
    {
        $this->processFactory->willReturn(0);

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSite('app.example.com');
        $contents = "server { listen 80; server_name app.example.com; }\n";

        $this->actingAs($user)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->patch(route('sites.nginx.update', $site), [
                'contents' => $contents,
            ])
            ->assertRedirect();

        $writeCall = collect($this->processFactory->calls)->first(
            fn (array $call): bool => ($call['command'][2] ?? '') === SudoWrapper::Nginx->path()
                && ($call['command'][3] ?? '') === 'write',
        );

        $this->assertNotNull($writeCall);
        $this->assertSame(
            ['sudo', '-n', SudoWrapper::Nginx->path(), 'write', $site->name],
            $writeCall['command'],
        );
        $this->assertSame(rtrim($contents, "\n"), rtrim((string) $writeCall['input'], "\n"));
    }

    public function test_environment_save_uses_beacon_fs_with_json_payload(): void
    {
        $this->processFactory->willReturn(0, 'APP_NAME=Updated');

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSite('app.example.com');
        $contents = "APP_NAME=Updated\nAPP_ENV=local\n";

        $this->actingAs($user)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->patch(route('sites.environment.update', $site), [
                'contents' => $contents,
            ])
            ->assertRedirect();

        $writeCall = collect($this->processFactory->calls)->first(function (array $call): bool {
            if (($call['command'][4] ?? '') !== SudoWrapper::Fs->path()) {
                return false;
            }

            $payload = json_decode((string) ($call['input'] ?? ''), true);

            return is_array($payload) && ($payload['action'] ?? null) === 'write';
        });

        $this->assertNotNull($writeCall);
        $this->assertSame(
            ['sudo', '-n', '-u', ProcessRunner::SITE_USER, SudoWrapper::Fs->path()],
            $writeCall['command'],
        );

        $payload = json_decode((string) $writeCall['input'], true);
        $this->assertSame('write', $payload['action'] ?? null);
        $this->assertSame("{$site->path}/.env", $payload['path'] ?? null);
        $this->assertSame(rtrim($contents, "\n"), rtrim((string) ($payload['contents'] ?? ''), "\n"));
    }

    public function test_console_command_runs_through_beacon_run_as_site_user(): void
    {
        $this->processFactory->willReturn(0, "beacon\n");

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSite('app.example.com');

        $this->actingAs($user)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->post(route('sites.commands.store', $site), [
                'command' => 'whoami',
            ])
            ->assertRedirect();

        $runCall = collect($this->processFactory->calls)->first(
            fn (array $call): bool => ($call['command'][4] ?? '') === SudoWrapper::Run->path(),
        );

        $this->assertNotNull($runCall);
        $this->assertSame(
            ['sudo', '-n', '-u', ProcessRunner::SITE_USER, SudoWrapper::Run->path()],
            $runCall['command'],
        );

        $payload = json_decode((string) $runCall['input'], true);
        $this->assertSame($site->path, $payload['cwd'] ?? null);
        $this->assertStringContainsString('whoami', implode(' ', $payload['argv'] ?? []));
    }

    public function test_panel_update_invokes_beacon_update_wrapper(): void
    {
        $this->processFactory->willReturn(0, "Deployed v1.2.3\n");

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);

        $this->actingAs($user)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->post(route('updates.store'), [
                'tag' => 'v1.2.3',
            ])
            ->assertRedirect(route('updates.edit'));

        $updateCall = collect($this->processFactory->calls)->first(
            fn (array $call): bool => ($call['command'][2] ?? '') === SudoWrapper::Update->path(),
        );

        $this->assertNotNull($updateCall);
        $this->assertSame(
            ['sudo', '-n', SudoWrapper::Update->path(), 'deploy', 'v1.2.3'],
            $updateCall['command'],
        );
    }

    public function test_site_delete_invokes_nginx_delete_and_beacon_run_rm(): void
    {
        $this->processFactory->willReturn(0);

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSite('app.example.com');

        $this->actingAs($user)->delete(route('sites.destroy', $site), [
            'confirmation' => $site->name,
        ])->assertRedirect(route('sites.index'));

        $nginxDelete = collect($this->processFactory->calls)->first(
            fn (array $call): bool => ($call['command'][2] ?? '') === SudoWrapper::Nginx->path()
                && ($call['command'][3] ?? '') === 'delete',
        );

        $this->assertNotNull($nginxDelete);
        $this->assertSame(
            ['sudo', '-n', SudoWrapper::Nginx->path(), 'delete', $site->name],
            $nginxDelete['command'],
        );

        $rmCalls = collect($this->processFactory->calls)->filter(
            fn (array $call): bool => ($call['command'][4] ?? '') === SudoWrapper::Run->path(),
        );

        $this->assertGreaterThanOrEqual(1, $rmCalls->count());

        $siteRemoval = $rmCalls->first(function (array $call) use ($site): bool {
            $payload = json_decode((string) ($call['input'] ?? ''), true);

            return is_array($payload)
                && in_array('/bin/rm', $payload['argv'] ?? [], true)
                && in_array('-rf', $payload['argv'] ?? [], true)
                && in_array($site->path, $payload['argv'] ?? [], true);
        });

        $this->assertNotNull($siteRemoval);
    }

    public function test_cron_scheduler_sync_writes_through_beacon_cron(): void
    {
        $this->processFactory->willReturn(0, '');

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSite('app.example.com');

        $this->actingAs($user)->post(route('sites.cron.scheduler', $site), [
            'enabled' => true,
        ])->assertRedirect();

        $writeCall = collect($this->processFactory->calls)->first(
            fn (array $call): bool => ($call['command'][2] ?? '') === SudoWrapper::Cron->path()
                && ($call['command'][3] ?? '') === 'write',
        );

        $this->assertNotNull($writeCall);
        $this->assertSame(
            ['sudo', '-n', SudoWrapper::Cron->path(), 'write'],
            $writeCall['command'],
        );
        $this->assertStringContainsString('# >>> BEACON MANAGED BLOCK', (string) ($writeCall['input'] ?? ''));
    }

    public function test_ssl_issue_invokes_beacon_certbot(): void
    {
        $certificatesOutput = <<<'OUTPUT'
Found the following certs:
  Certificate Name: app.example.com
    Domains: app.example.com
    Expiry Date: 2026-11-01 12:00:00+00:00 (VALID: 89 days)
OUTPUT;

        $this->processFactory->willReturn(0, $certificatesOutput);

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSite('app.example.com');

        $this->actingAs($user)->post(route('sites.ssl.issue', $site), [
            'email' => 'admin@example.com',
        ])->assertRedirect();

        $issueCall = collect($this->processFactory->calls)->first(
            fn (array $call): bool => ($call['command'][2] ?? '') === SudoWrapper::Certbot->path()
                && ($call['command'][3] ?? '') === 'issue',
        );

        $this->assertNotNull($issueCall);
        $this->assertSame('admin@example.com', $issueCall['command'][4] ?? null);
        $this->assertSame('app.example.com', $issueCall['command'][5] ?? null);
    }

    public function test_supervisor_create_writes_config_through_beacon_supervisor(): void
    {
        $this->processFactory->willReturn(0, "app-example-com-queue RUNNING pid 1\n");

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = $this->createSite('app.example.com');

        $this->actingAs($user)->post(route('sites.supervisor.store', $site), [
            'name' => 'queue',
            'queue' => 'default',
        ])->assertRedirect();

        $writeCall = collect($this->processFactory->calls)->first(
            fn (array $call): bool => ($call['command'][2] ?? '') === SudoWrapper::Supervisor->path()
                && ($call['command'][3] ?? '') === 'write',
        );

        $this->assertNotNull($writeCall);
        $this->assertSame('app-example-com-queue', $writeCall['command'][4] ?? null);
        $this->assertStringContainsString('[program:app-example-com-queue]', (string) ($writeCall['input'] ?? ''));
    }

    public function test_manual_deploy_runs_script_through_beacon_run(): void
    {
        $this->processFactory->willReturn(0, '', '');

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);
        $site = Site::factory()->laravel()->create([
            'server_id' => 1,
            'name' => 'app.example.com',
            'path' => '/home/beacon/app.example.com',
            'deploy_script' => "#!/usr/bin/env bash\necho deploy\n",
        ]);

        SiteDomain::query()->create([
            'site_id' => $site->id,
            'domain' => 'app.example.com',
            'is_primary' => true,
        ]);

        $this->actingAs($user)
            ->withSession(['auth.password_confirmed_at' => time()])
            ->post(route('sites.deployments.store', $site))
            ->assertRedirect();

        $deployCall = collect($this->processFactory->calls)->first(function (array $call): bool {
            if (($call['command'][4] ?? '') !== SudoWrapper::Run->path()) {
                return false;
            }

            $payload = json_decode((string) ($call['input'] ?? ''), true);

            return is_array($payload)
                && in_array('/bin/bash', $payload['argv'] ?? [], true);
        });

        $this->assertNotNull($deployCall);
    }

    public function test_database_backup_runs_mysqldump_command(): void
    {
        $this->processFactory->willReturn(0);

        $user = User::factory()->create();
        Server::factory()->create(['id' => 1]);

        $database = Database::factory()->create([
            'server_id' => 1,
            'name' => 'app_production',
        ]);

        $this->actingAs($user)->post(route('databases.backups.store', $database))->assertRedirect();

        $dumpCall = collect($this->processFactory->calls)->first(
            fn (array $call): bool => str_contains(implode(' ', $call['command']), 'mysqldump'),
        );

        $this->assertNotNull($dumpCall);
        $this->assertStringContainsString('app_production', implode(' ', $dumpCall['command']));
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
