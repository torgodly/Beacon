<?php

namespace Tests\Unit\Wrapper;

use Tests\TestCase;

class BeaconUpdateWrapperTest extends TestCase
{
    private string $script;

    protected function setUp(): void
    {
        parent::setUp();

        $this->script = base_path('bin/wrappers/beacon-update');
    }

    public function test_script_passes_bash_syntax_check(): void
    {
        exec('bash -n '.escapeshellarg($this->script).' 2>&1', $output, $code);

        $this->assertSame(0, $code, implode("\n", $output));
    }

    public function test_deploy_rejects_invalid_tag(): void
    {
        $this->runScript(['deploy', 'main'], $output, $code);

        $this->assertSame(64, $code);
        $this->assertStringContainsString('bad tag', implode("\n", $output));
    }

    public function test_unknown_action_is_rejected(): void
    {
        $this->runScript(['purge'], $output, $code);

        $this->assertSame(64, $code);
        $this->assertStringContainsString('unknown action', implode("\n", $output));
    }

    public function test_rollback_without_releases_exits_66(): void
    {
        $root = sys_get_temp_dir().'/beacon-update-'.uniqid('', true);
        mkdir($root.'/releases', 0755, true);

        $this->runScript(
            ['rollback'],
            $output,
            $code,
            [
                'BEACON_PANEL_ROOT' => $root,
            ],
        );

        $this->assertSame(66, $code);
        $this->assertStringContainsString('no previous release', implode("\n", $output));

        exec('rm -rf '.escapeshellarg($root));
    }

    /**
     * @param  list<string>  $args
     * @param  array<string, string>  $env
     */
    private function runScript(array $args, ?array &$output, ?int &$code, array $env = []): void
    {
        $command = 'env '.implode(' ', array_map(
            static fn (string $key, string $value): string => escapeshellarg("{$key}={$value}"),
            array_keys($env),
            array_values($env),
        )).' bash '.escapeshellarg($this->script).' '.implode(' ', array_map('escapeshellarg', $args)).' 2>&1';

        exec($command, $output, $code);
    }
}
