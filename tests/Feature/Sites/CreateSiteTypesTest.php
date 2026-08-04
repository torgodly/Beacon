<?php

namespace Tests\Feature\Sites;

use App\Actions\Site\CreateSite;
use App\Models\PhpVersion;
use App\Models\Server;
use App\Models\Site;
use App\Services\System\ProcessFactory;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Support\FakeProcessFactory;
use Tests\TestCase;

/**
 * Every site type must provision cleanly.
 *
 * These lock in the things that actually broke in production:
 *  - beacon-run rejected /home/beacon as a working directory, so no site could
 *    be created at all;
 *  - the site tree was left beacon:beacon 0750, which nginx (www-data) cannot
 *    traverse, so every static and Laravel site would have answered 403;
 *  - static sites were given "/" as their document root while the UI and the
 *    default deploy script both used /dist.
 */
class CreateSiteTypesTest extends TestCase
{
    use RefreshDatabase;

    private FakeProcessFactory $processFactory;

    protected function setUp(): void
    {
        parent::setUp();

        $this->processFactory = new FakeProcessFactory;
        $this->processFactory->willReturn(0, "server { listen 80; }\n");
        $this->app->instance(ProcessFactory::class, $this->processFactory);

        Server::factory()->create(['id' => 1]);
        PhpVersion::query()->create([
            'server_id' => 1,
            'version' => '8.4',
            'status' => 'installed',
        ]);
    }

    public function test_static_site_serves_from_repository_root_and_needs_no_runtime(): void
    {
        $site = $this->create(['name' => 'static.example.com', 'type' => 'static']);

        $this->assertSame('/', $site->web_directory);
        $this->assertNull($site->php_version);
        $this->assertNull($site->proxy_port);
        $this->assertSame('active', $site->status);
        $this->assertStringContainsString(
            'No package.json',
            (string) $site->deploy_script,
        );

        // Site root only — plain HTML lives here; /dist is opt-in for Vite builds.
        $this->assertCommandRun(['/bin/mkdir', '-p', '/home/beacon/static.example.com']);

        // No FPM pool for a site with no PHP.
        $this->assertNoCommandMatching('pool-write');
        $this->assertSame(0, $site->supervisorProcesses()->count());
    }

    public function test_laravel_site_gets_public_root_pool_and_private_dirs(): void
    {
        $site = $this->create([
            'name' => 'app.example.com',
            'type' => 'laravel',
            'php_version' => '8.4',
            'database_strategy' => 'none',
        ]);

        $this->assertSame('/public', $site->web_directory);
        $this->assertCommandRun(['/bin/mkdir', '-p', '/home/beacon/app.example.com/public']);
        $this->assertCommandRun(['/bin/mkdir', '-p', '/home/beacon/app.example.com/storage/sessions']);

        // Pool-write stdin must never emit an empty user line — php-fpm treats
        // that as root and refuses to start, taking down the panel pool too.
        $poolWrite = collect($this->processFactory->calls)->first(
            fn (array $call): bool => str_contains(implode(' ', $call['command']), 'pool-write'),
        );
        $this->assertNotNull($poolWrite);
        $this->assertStringContainsString('user  = beacon', (string) $poolWrite['input']);

        // Session storage is created after the group sweep and stays 0700.
        $this->assertCommandRun(['/bin/chmod', '0700', '/home/beacon/app.example.com/storage/sessions']);
    }

    public function test_laravel_site_defers_fpm_reload_until_the_request_terminates(): void
    {
        $this->create([
            'name' => 'deferred.example.com',
            'type' => 'laravel',
            'php_version' => '8.4',
        ]);

        $this->assertNoCommandMatching('fpm-reload');

        $this->app->terminate();

        $reload = collect($this->processFactory->calls)->first(
            fn (array $call): bool => in_array('fpm-reload', $call['command'], true),
        );

        $this->assertNotNull($reload, 'fpm-reload should run after the HTTP response is sent');
    }

    /**
     * @return array<string, array{string}>
     */
    public static function ssrTypes(): array
    {
        return ['nextjs' => ['nextjs'], 'nuxt' => ['nuxt']];
    }

    #[DataProvider('ssrTypes')]
    public function test_ssr_sites_get_a_port_and_a_supervisor_process(string $type): void
    {
        $site = $this->create([
            'name' => "{$type}.example.com",
            'type' => $type,
            'node_version' => '22',
        ]);

        $this->assertNotNull($site->proxy_port, 'SSR sites need a local port to proxy to.');
        $this->assertNull($site->php_version);
        $this->assertNoCommandMatching('pool-write');

        // Without this the vhost proxies to a port nothing listens on.
        $ssr = $site->supervisorProcesses()->where('kind', 'ssr')->first();
        $this->assertNotNull($ssr);
        $this->assertFalse((bool) $ssr->autostart, 'Nothing is deployed yet.');
    }

    public function test_every_type_makes_the_tree_readable_by_nginx(): void
    {
        foreach (['laravel', 'static', 'nextjs', 'nuxt'] as $type) {
            $this->processFactory->calls = [];

            $site = $this->create([
                'name' => "{$type}-perms.example.com",
                'type' => $type,
                'php_version' => $type === 'laravel' ? '8.4' : null,
                'node_version' => in_array($type, ['nextjs', 'nuxt'], true) ? '22' : null,
            ]);

            // beacon:beacon 0750 is unreadable by www-data — a 403 on every request.
            $this->assertCommandRun(['/bin/chgrp', '-R', 'www-data', $site->path], $type);
            $this->assertCommandRun(
                ['/bin/find', $site->path, '-type', 'd', '-exec', 'chmod', '2750', '{}', '+'],
                $type,
            );
        }
    }

    public function test_work_runs_from_the_sites_home_which_the_wrapper_allows(): void
    {
        $this->create(['name' => 'cwd.example.com', 'type' => 'static']);

        // beacon-run rejected "/home/beacon" because it only matched paths with
        // a trailing slash: "cwd outside permitted roots: /home/beacon".
        foreach ($this->siteJobs() as $job) {
            $this->assertSame('/home/beacon', $job['cwd']);
        }
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function create(array $data): Site
    {
        return app(CreateSite::class)->handle([
            'php_version' => null,
            'node_version' => null,
            ...$data,
        ]);
    }

    /**
     * Job specs handed to beacon-run, which travel as JSON on stdin.
     *
     * @return list<array{cwd: string, argv: list<string>}>
     */
    private function siteJobs(): array
    {
        $jobs = [];

        foreach ($this->processFactory->calls as $call) {
            if (! in_array('/opt/beacon/bin/beacon-run', $call['command'], true)) {
                continue;
            }

            $spec = json_decode((string) $call['input'], true);

            if (is_array($spec) && isset($spec['argv'], $spec['cwd'])) {
                $jobs[] = $spec;
            }
        }

        return $jobs;
    }

    /**
     * @param  list<string>  $argv
     */
    private function assertCommandRun(array $argv, string $context = ''): void
    {
        $found = collect($this->siteJobs())->contains(
            fn (array $job): bool => $job['argv'] === $argv,
        );

        $this->assertTrue($found, trim($context.' expected command: '.implode(' ', $argv)));
    }

    private function assertNoCommandMatching(string $needle): void
    {
        foreach ($this->processFactory->calls as $call) {
            $this->assertStringNotContainsString(
                $needle,
                implode(' ', $call['command']),
            );
        }
    }
}
