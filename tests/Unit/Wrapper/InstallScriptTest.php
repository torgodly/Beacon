<?php

namespace Tests\Unit\Wrapper;

use Tests\TestCase;

class InstallScriptTest extends TestCase
{
    private string $script;

    protected function setUp(): void
    {
        parent::setUp();

        $this->script = base_path('install.sh');
    }

    public function test_install_script_passes_bash_syntax_check(): void
    {
        exec('bash -n '.escapeshellarg($this->script).' 2>&1', $output, $code);

        $this->assertSame(0, $code, implode("\n", $output));
    }

    public function test_panel_deploy_templates_exist(): void
    {
        $files = [
            'deploy/nginx/beacon-global.conf',
            'deploy/nginx/000-catch-all.conf',
            'deploy/nginx/beacon-panel.conf',
            'deploy/nginx/beacon-panel-8443.conf',
            'deploy/php/beacon-panel.pool.conf',
            'deploy/supervisor/beacon-panel-worker.conf',
            'deploy/env/panel.env',
            'deploy/mysql/99-beacon.cnf',
        ];

        foreach ($files as $file) {
            $this->assertFileExists(base_path($file), "Missing {$file}");
        }
    }

    public function test_panel_env_template_contains_required_keys(): void
    {
        $contents = file_get_contents(base_path('deploy/env/panel.env'));

        $this->assertIsString($contents);
        $this->assertStringContainsString('APP_KEY=__APP_KEY__', $contents);
        $this->assertStringContainsString('DB_DATABASE=__PANEL_SHARED__/beacon.sqlite', $contents);
        $this->assertStringContainsString('BEACON_HEALTH_STRICT=true', $contents);
    }

    public function test_install_script_configures_ufw_beacon_umask_and_self_signed_panel(): void
    {
        $contents = file_get_contents($this->script);

        $this->assertIsString($contents);
        $this->assertStringContainsString('configure_ufw', $contents);
        $this->assertStringContainsString('ufw allow 8443/tcp', $contents);
        $this->assertStringContainsString('umask 0002', $contents);
        $this->assertStringContainsString('configure_panel_self_signed_tls', $contents);
        $this->assertStringContainsString('beacon-panel-8443.conf', $contents);

        $functionsPos = strpos($contents, 'bootstrap_panel()');
        $mainPos = strpos($contents, '# ── Base packages (best-effort)');

        $this->assertNotFalse($functionsPos);
        $this->assertNotFalse($mainPos);
        $this->assertLessThan($mainPos, $functionsPos, 'Functions must be defined before main execution.');
    }

    public function test_install_script_provisions_php_node_and_bun_runtimes(): void
    {
        $contents = file_get_contents($this->script);

        $this->assertIsString($contents);
        $this->assertStringContainsString('install_php_versions', $contents);
        $this->assertStringContainsString('BEACON_PHP_VERSIONS=(8.1 8.2 8.3 8.4)', $contents);
        $this->assertStringContainsString('install_node_runtimes', $contents);
        $this->assertStringContainsString('/usr/local/node/default', $contents);
        $this->assertStringContainsString('install_bun_runtime', $contents);
        $this->assertStringContainsString('/usr/local/bun/default/bin/bun', $contents);
        $this->assertStringNotContainsString('apt-get install -y -qq nodejs npm', $contents);
    }

    public function test_install_script_includes_forge_provisioning_tricks(): void
    {
        $contents = file_get_contents($this->script);

        $this->assertIsString($contents);
        $this->assertStringContainsString('apt_wait()', $contents);
        $this->assertStringContainsString('/var/lib/dpkg/lock-frontend', $contents);
        $this->assertStringContainsString('seed_git_known_hosts', $contents);
        $this->assertStringContainsString('ssh-keyscan -H github.com gitlab.com bitbucket.org', $contents);
        $this->assertStringContainsString('configure_nginx_catch_all', $contents);
        $this->assertStringContainsString('000-catch-all', $contents);
        $this->assertStringContainsString('return 444', file_get_contents(base_path('deploy/nginx/000-catch-all.conf')));
        $this->assertStringContainsString('https://ppa.setup-php.com/ondrej/php/ubuntu', $contents);
        $this->assertStringNotContainsString('add-apt-repository', $contents);
    }
}
