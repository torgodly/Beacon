<?php

namespace Tests\Unit\Services\Deployment;

use App\Models\Site;
use App\Services\Deployment\DeployScriptFactory;
use App\Services\System\SiteFilesystem;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery;
use Mockery\MockInterface;
use Tests\TestCase;

class DeployScriptFactoryTest extends TestCase
{
    use RefreshDatabase;

    public function test_static_script_skips_npm_without_package_json(): void
    {
        $site = Site::factory()->create(['type' => 'static']);

        $script = app(DeployScriptFactory::class)->forSite($site);

        $this->assertStringContainsString('if [ -f package.json ]', $script);
        $this->assertStringContainsString('No package.json', $script);
    }

    public function test_ssr_script_requires_package_json(): void
    {
        $site = Site::factory()->create(['type' => 'nextjs']);

        $script = app(DeployScriptFactory::class)->forSite($site);

        $this->assertStringContainsString('if [ ! -f package.json ]', $script);
        $this->assertStringContainsString('--include=dev', $script);
        $this->assertStringContainsString('exit 1', $script);
    }

    public function test_laravel_script_bootstraps_env_before_composer(): void
    {
        $site = Site::factory()->create(['type' => 'laravel']);

        $script = app(DeployScriptFactory::class)->forSite($site);

        $this->assertStringContainsString('cp .env.example .env', $script);
        $this->assertStringContainsString('artisan key:generate --force', $script);
        $this->assertStringContainsString('artisan migrate --force', $script);
        $this->assertStringContainsString('BEACON_APP_ENV', $script);
        $this->assertStringContainsString('BEACON_DB_DRIVER', $script);
        $this->assertStringContainsString('BEACON_REDIS_ENABLED', $script);
        $this->assertStringContainsString('artisan optimize:clear', $script);
        $this->assertStringContainsString('--no-dev', $script);
        $this->assertGreaterThan(
            strpos($script, '$BEACON_COMPOSER install'),
            strpos($script, 'artisan key:generate --force'),
        );
    }

    public function test_refresh_legacy_default_fixes_laravel_script_with_unsafe_env_writer(): void
    {
        $broken = <<<'BASH'
#!/usr/bin/env bash
set -euo pipefail
set_env_var DB_PASSWORD "${BEACON_DB_PASSWORD:-}"
BASH;

        $site = Site::factory()->create([
            'type' => 'laravel',
            'deploy_script' => $broken,
        ]);

        $this->mock(SiteFilesystem::class, function (MockInterface $mock): void {
            $mock->shouldReceive('write')->once();
        });

        $refreshed = app(DeployScriptFactory::class)->refreshLegacyDefault(
            $site,
            app(SiteFilesystem::class),
        );

        $this->assertTrue($refreshed);
        $this->assertStringContainsString(
            'set_env_var DB_PASSWORD BEACON_DB_PASSWORD',
            (string) $site->fresh()->deploy_script,
        );
        $this->assertStringContainsString('artisan config:clear', (string) $site->fresh()->deploy_script);
    }

    public function test_refresh_legacy_default_fixes_laravel_script_with_artisan_before_composer(): void
    {
        $broken = <<<'BASH'
#!/usr/bin/env bash
set -euo pipefail
cd "$BEACON_SITE_DIR"
$BEACON_PHP artisan key:generate --force
$BEACON_COMPOSER install --no-interaction --prefer-dist --optimize-autoloader --no-dev
BASH;

        $site = Site::factory()->create([
            'type' => 'laravel',
            'deploy_script' => $broken,
        ]);

        $this->mock(SiteFilesystem::class, function (MockInterface $mock): void {
            $mock->shouldReceive('write')->once();
        });

        $refreshed = app(DeployScriptFactory::class)->refreshLegacyDefault(
            $site,
            app(SiteFilesystem::class),
        );

        $this->assertTrue($refreshed);
        $updated = (string) $site->fresh()->deploy_script;
        $this->assertGreaterThan(
            strpos($updated, '$BEACON_COMPOSER install'),
            strpos($updated, 'artisan key:generate --force'),
        );
    }

    public function test_refresh_legacy_default_rewrites_old_static_script(): void
    {
        $legacy = <<<'BASH'
#!/usr/bin/env bash
set -euo pipefail
cd "$BEACON_SITE_DIR"
$BEACON_PM install --frozen-lockfile || $BEACON_PM install
$BEACON_PM run build
BASH;

        $site = Site::factory()->create([
            'type' => 'static',
            'deploy_script' => $legacy,
        ]);

        $this->mock(SiteFilesystem::class, function (MockInterface $mock) use ($site): void {
            $mock->shouldReceive('write')
                ->once()
                ->with($site->deployScriptPath(), Mockery::on(
                    fn (string $script): bool => str_contains($script, 'No package.json'),
                ), 0700);
        });

        $refreshed = app(DeployScriptFactory::class)->refreshLegacyDefault(
            $site,
            app(SiteFilesystem::class),
        );

        $this->assertTrue($refreshed);
        $this->assertStringContainsString('No package.json', (string) $site->fresh()->deploy_script);
    }

    public function test_ssr_script_bootstraps_env_from_example(): void
    {
        $site = Site::factory()->create(['type' => 'nextjs']);

        $script = app(DeployScriptFactory::class)->forSite($site);

        $this->assertStringContainsString('cp .env.example .env', $script);
        $this->assertStringContainsString('--include=dev', $script);
        $this->assertStringNotContainsString('fiif [', $script);
        $this->assertDoesNotMatchRegularExpression(
            '/cd "\$BEACON_SITE_DIR"[^\n]/',
            $script,
        );
    }

    public function test_refresh_legacy_default_rewrites_nextjs_script_without_env_bootstrap(): void
    {
        $legacy = <<<'BASH'
#!/usr/bin/env bash
set -euo pipefail
cd "$BEACON_SITE_DIR"
$BEACON_PM ci || $BEACON_PM install
$BEACON_PM run build
BASH;

        $site = Site::factory()->create([
            'type' => 'nextjs',
            'deploy_script' => $legacy,
        ]);

        $this->mock(SiteFilesystem::class, function (MockInterface $mock): void {
            $mock->shouldReceive('write')->once();
        });

        $refreshed = app(DeployScriptFactory::class)->refreshLegacyDefault(
            $site,
            app(SiteFilesystem::class),
        );

        $this->assertTrue($refreshed);
        $this->assertStringContainsString('cp .env.example .env', (string) $site->fresh()->deploy_script);
    }

    public function test_refresh_legacy_default_rewrites_nextjs_script_with_broken_line_breaks(): void
    {
        $broken = <<<'BASH'
#!/usr/bin/env bash
set -euo pipefail
cd "$BEACON_SITE_DIR"# broken bootstrap
if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
  echo "Created .env from .env.example — review values under the Env tab."
fiif [ ! -f package.json ]; then
  exit 1
fi
BASH;

        $site = Site::factory()->create([
            'type' => 'nextjs',
            'deploy_script' => $broken,
        ]);

        $this->mock(SiteFilesystem::class, function (MockInterface $mock): void {
            $mock->shouldReceive('write')->once();
        });

        $refreshed = app(DeployScriptFactory::class)->refreshLegacyDefault(
            $site,
            app(SiteFilesystem::class),
        );

        $this->assertTrue($refreshed);
        $updated = (string) $site->fresh()->deploy_script;
        $this->assertStringNotContainsString('fiif [', $updated);
        $this->assertDoesNotMatchRegularExpression(
            '/cd "\$BEACON_SITE_DIR"[^\n]/',
            $updated,
        );
    }

    public function test_refresh_legacy_default_rewrites_nextjs_script_with_frozen_lockfile_flag(): void
    {
        $legacy = <<<'BASH'
#!/usr/bin/env bash
set -euo pipefail
cd "$BEACON_SITE_DIR"
$BEACON_PM install --frozen-lockfile || $BEACON_PM install
$BEACON_PM run build
BASH;

        $site = Site::factory()->create([
            'type' => 'nextjs',
            'deploy_script' => $legacy,
        ]);

        $this->mock(SiteFilesystem::class, function (MockInterface $mock): void {
            $mock->shouldReceive('write')->once();
        });

        $refreshed = app(DeployScriptFactory::class)->refreshLegacyDefault(
            $site,
            app(SiteFilesystem::class),
        );

        $this->assertTrue($refreshed);
        $this->assertStringContainsString(
            '--include=dev',
            (string) $site->fresh()->deploy_script,
        );
        $this->assertStringNotContainsString('--frozen-lockfile', (string) $site->fresh()->deploy_script);
    }

    public function test_refresh_legacy_default_rewrites_npm_install_without_dev_dependencies(): void
    {
        $filesystem = Mockery::mock(SiteFilesystem::class, function (MockInterface $mock): void {
            $mock->shouldReceive('write')->once();
        });

        $legacy = <<<'BASH'
#!/usr/bin/env bash
set -euo pipefail
cd "$BEACON_SITE_DIR"
$BEACON_COMPOSER install --no-interaction --prefer-dist --optimize-autoloader
if [ -f package.json ]; then
  $BEACON_PM ci || $BEACON_PM install
  $BEACON_PM run build
fi
BASH;

        $site = Site::factory()->create([
            'type' => 'laravel',
            'deploy_script' => $legacy,
        ]);

        $refreshed = app(DeployScriptFactory::class)->refreshLegacyDefault(
            $site,
            $filesystem,
        );

        $this->assertTrue($refreshed);
        $this->assertStringContainsString('--include=dev', (string) $site->fresh()->deploy_script);
    }

    public function test_refresh_legacy_default_leaves_custom_scripts_alone(): void
    {
        $site = Site::factory()->create([
            'type' => 'static',
            'deploy_script' => "#!/usr/bin/env bash\necho custom\n",
        ]);

        $this->mock(SiteFilesystem::class, function (MockInterface $mock): void {
            $mock->shouldNotReceive('write');
        });

        $refreshed = app(DeployScriptFactory::class)->refreshLegacyDefault(
            $site,
            app(SiteFilesystem::class),
        );

        $this->assertFalse($refreshed);
    }
}
