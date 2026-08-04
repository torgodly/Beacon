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
        $this->assertStringContainsString('exit 1', $script);
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
