<?php

namespace Tests\Feature\Sites;

use App\Models\Server;
use App\Models\Site;
use App\Models\SiteDomain;
use App\Services\Supervisor\SsrLauncher;
use App\Services\Supervisor\SupervisorService;
use App\Services\System\ProcessFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Support\FakeProcessFactory;
use Tests\TestCase;

/**
 * Next.js / Nuxt sites are served through an Nginx reverse proxy to a local
 * port. If nothing registers a Node process on that port the site 502s
 * forever, so these tests lock in that the SSR unit is always created.
 */
class SsrProcessTest extends TestCase
{
    use RefreshDatabase;

    private FakeProcessFactory $processFactory;

    protected function setUp(): void
    {
        parent::setUp();

        $this->processFactory = new FakeProcessFactory;
        $this->processFactory->willReturn(0, "app-example-com-ssr RUNNING pid 1\n");
        $this->app->instance(ProcessFactory::class, $this->processFactory);
    }

    public function test_nextjs_site_gets_a_stopped_ssr_process(): void
    {
        $site = $this->createSite('nextjs');

        $process = app(SupervisorService::class)->syncSsrProcess($site);

        $this->assertNotNull($process);
        $this->assertSame('ssr', $process->kind);
        $this->assertSame('app-example-com-ssr', $process->program_name);
        $this->assertSame('beacon', $process->run_as);

        // Nothing is deployed yet, so Supervisor must not try to launch it.
        $this->assertFalse((bool) $process->autostart);

        $this->assertDatabaseHas('supervisor_processes', [
            'site_id' => $site->id,
            'kind' => 'ssr',
            'is_system' => true,
        ]);
    }

    public function test_a_successful_deployment_enables_autostart(): void
    {
        $site = $this->createSite('nextjs');
        $supervisor = app(SupervisorService::class);

        $supervisor->syncSsrProcess($site);
        $enabled = $supervisor->syncSsrProcess($site, autostart: true);

        $this->assertNotNull($enabled);
        $this->assertTrue((bool) $enabled->autostart);
        $this->assertSame(1, $site->supervisorProcesses()->where('kind', 'ssr')->count());
    }

    public function test_resyncing_preserves_autostart(): void
    {
        $site = $this->createSite('nuxt');
        $supervisor = app(SupervisorService::class);

        $supervisor->syncSsrProcess($site, autostart: true);

        // A runtime change re-renders the launcher; it must not stop a live site.
        $resynced = $supervisor->syncSsrProcess($site);

        $this->assertNotNull($resynced);
        $this->assertTrue((bool) $resynced->autostart);
    }

    public function test_laravel_and_static_sites_get_no_ssr_process(): void
    {
        foreach (['laravel', 'static'] as $type) {
            $site = $this->createSite($type, "{$type}.example.com");

            $this->assertNull(app(SupervisorService::class)->syncSsrProcess($site));
            $this->assertSame(0, $site->supervisorProcesses()->where('kind', 'ssr')->count());
        }
    }

    public function test_launcher_execs_the_right_server_for_each_type(): void
    {
        $launcher = app(SsrLauncher::class);

        $site = $this->createSite('nextjs');
        $next = $launcher->script($site);
        $this->assertStringContainsString('exec node_modules/.bin/next start', $next);
        $this->assertStringContainsString("export PORT={$site->proxy_port}", $next);
        $this->assertStringContainsString('export HOST=127.0.0.1', $next);
        $this->assertStringContainsString('/usr/local/node/v22/bin', $next);

        $nuxt = $launcher->script($this->createSite('nuxt', 'nuxt.example.com'));
        $this->assertStringContainsString('exec node .output/server/index.mjs', $nuxt);
    }

    public function test_launcher_sources_site_env_files_before_exec(): void
    {
        $script = app(SsrLauncher::class)->script($this->createSite('nextjs'));

        $envBlock = strpos($script, 'load_env_file .env');
        $execLine = strpos($script, 'exec ');

        $this->assertNotFalse($envBlock);
        $this->assertNotFalse($execLine);
        $this->assertLessThan($execLine, $envBlock, 'Env files must load before exec.');
        $this->assertStringContainsString('load_env_file .env.local', $script);
        $this->assertStringContainsString('load_env_file .env.production', $script);
    }

    private function createSite(string $type, string $name = 'app.example.com'): Site
    {
        if (Server::query()->find(1) === null) {
            Server::factory()->create(['id' => 1]);
        }

        $site = Site::factory()->create([
            'server_id' => 1,
            'name' => $name,
            'type' => $type,
            'path' => '/home/beacon/'.$name,
            'node_version' => in_array($type, ['nextjs', 'nuxt'], true) ? '22' : null,
            'php_version' => $type === 'laravel' ? '8.4' : null,
            'proxy_port' => in_array($type, ['nextjs', 'nuxt'], true)
                ? 3101 + (Site::query()->count() * 1)
                : null,
        ]);

        SiteDomain::query()->create([
            'site_id' => $site->id,
            'domain' => $name,
            'is_primary' => true,
        ]);

        return $site;
    }
}
