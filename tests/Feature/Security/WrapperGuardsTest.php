<?php

namespace Tests\Feature\Security;

use Tests\TestCase;

class WrapperGuardsTest extends TestCase
{
    /**
     * @param  list<string>  $args
     * @param  array<string, string>  $env
     */
    private function runWrapper(string $wrapper, array $args, ?string $stdin = null, array $env = []): array
    {
        $script = base_path("bin/wrappers/beacon-{$wrapper}");
        $command = $env === []
            ? escapeshellarg($script)
            : 'env '.implode(' ', array_map(
                static fn (string $key, string $value): string => escapeshellarg("{$key}={$value}"),
                array_keys($env),
                array_values($env),
            )).' '.escapeshellarg($script);
        foreach ($args as $arg) {
            $command .= ' '.escapeshellarg($arg);
        }
        $command .= ' 2>&1';

        $descriptors = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];

        $process = proc_open($command, $descriptors, $pipes, base_path());

        if (! is_resource($process)) {
            $this->fail('Could not execute wrapper.');
        }

        if ($stdin !== null) {
            fwrite($pipes[0], $stdin);
        }
        fclose($pipes[0]);

        $output = stream_get_contents($pipes[1]).stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);

        $code = proc_close($process);

        return [$code, $output];
    }

    public function test_beacon_nginx_refuses_to_delete_panel_vhost(): void
    {
        [$code, $output] = $this->runWrapper('nginx', ['delete', 'beacon-panel']);

        $this->assertSame(64, $code);
        $this->assertStringContainsString('reserved vhost', $output);
    }

    public function test_beacon_nginx_rejects_invalid_site_names(): void
    {
        [$code, $output] = $this->runWrapper('nginx', ['write', '../../etc/passwd']);

        $this->assertSame(64, $code);
        $this->assertStringContainsString('invalid site name', $output);
    }

    public function test_beacon_supervisor_rejects_root_user(): void
    {
        $confDir = sys_get_temp_dir().'/beacon-supervisor-'.uniqid('', true);
        mkdir($confDir, 0755, true);

        $config = <<<'INI'
[program:evil]
command = /usr/bin/true
directory = /home/beacon/example.com
user = root
INI;

        [$code, $output] = $this->runWrapper(
            'supervisor',
            ['write', 'evil'],
            $config,
            ['BEACON_SUPERVISOR_CONF_DIR' => $confDir],
        );

        exec('rm -rf '.escapeshellarg($confDir));

        $this->assertSame(64, $code);
        $this->assertStringContainsString('may not run as root', $output);
    }

    public function test_beacon_supervisor_rejects_reserved_program_names(): void
    {
        $config = <<<'INI'
[program:beacon-panel-worker]
command = /usr/bin/true
directory = /home/beacon/example.com
user = beacon
INI;

        [$code, $output] = $this->runWrapper('supervisor', ['write', 'beacon-panel-worker'], $config);

        $this->assertSame(64, $code);
        $this->assertStringContainsString('reserved program name', $output);
    }

    public function test_beacon_service_rejects_disallowed_units(): void
    {
        [$code, $output] = $this->runWrapper('service', ['restart', 'ssh']);

        $this->assertSame(64, $code);
        $this->assertStringContainsString('unit not allowed', $output);
    }

    public function test_beacon_fs_rejects_paths_outside_home_beacon(): void
    {
        [$code, $output] = $this->runWrapper('fs', [], json_encode([
            'action' => 'read',
            'path' => '/etc/passwd',
        ]));

        $this->assertSame(64, $code);
        $this->assertStringContainsString('path outside permitted root', $output);
    }

    public function test_beacon_cron_rejects_unknown_actions(): void
    {
        [$code, $output] = $this->runWrapper('cron', ['purge']);

        $this->assertSame(64, $code);
        $this->assertStringContainsString('unknown action', $output);
    }

    public function test_beacon_certbot_rejects_invalid_email(): void
    {
        [$code, $output] = $this->runWrapper('certbot', ['issue', 'not-an-email', 'example.com']);

        $this->assertSame(64, $code);
        $this->assertStringContainsString('invalid email', $output);
    }

    public function test_beacon_certbot_rejects_invalid_domain(): void
    {
        [$code, $output] = $this->runWrapper('certbot', ['issue', 'admin@example.com', '../../etc']);

        $this->assertSame(64, $code);
        $this->assertStringContainsString('invalid domain', $output);
    }

    public function test_beacon_php_rejects_invalid_pool_site_name(): void
    {
        [$code, $output] = $this->runWrapper('php', ['pool-write', '../../etc/passwd', '8.4'], '[www]');

        $this->assertSame(64, $code);
        $this->assertStringContainsString('invalid site name', $output);
    }

    public function test_beacon_php_rejects_reserved_pool_names(): void
    {
        [$code, $output] = $this->runWrapper('php', ['pool-write', 'beacon.panel', '8.4'], '[beacon-panel]
user = beacon');

        $this->assertSame(64, $code);
        $this->assertStringContainsString('reserved pool name', $output);
    }

    public function test_beacon_php_rejects_invalid_version(): void
    {
        [$code, $output] = $this->runWrapper('php', ['pool-write', 'example.com', '7.4'], '[www]');

        $this->assertSame(64, $code);
        $this->assertStringContainsString('invalid PHP version', $output);
    }

    public function test_beacon_pkg_rejects_unknown_extension(): void
    {
        [$code, $output] = $this->runWrapper('pkg', ['ext-install', '8.4', 'evil']);

        $this->assertSame(64, $code);
        $this->assertStringContainsString('extension not installable', $output);
    }
}
