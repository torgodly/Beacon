<?php

namespace App\Services\Server;

use App\Services\System\ProcessRunner;
use App\Services\System\SudoWrapper;
use Illuminate\Support\Facades\Redis;

class HealthCheckService
{
    public function __construct(private readonly ProcessRunner $runner) {}

    /**
     * @return array{healthy: bool, issues: list<array{severity: string, message: string}>}
     */
    public function check(): array
    {
        $issues = [];

        if (config('beacon.health.strict', false)) {
            $issues = [...$issues, ...$this->hostChecks()];
            $issues = [...$issues, ...$this->provisionedRuntimeChecks()];
        }

        $issues = [...$issues, ...$this->runtimeChecks()];

        $hasCritical = collect($issues)->contains(fn (array $issue): bool => $issue['severity'] === 'critical');

        return [
            'healthy' => ! $hasCritical,
            'issues' => $issues,
        ];
    }

    /**
     * @return list<array{severity: string, message: string}>
     */
    private function hostChecks(): array
    {
        $issues = [];

        foreach (SudoWrapper::cases() as $wrapper) {
            $path = $wrapper->path();
            if (! is_file($path)) {
                $issues[] = [
                    'severity' => 'warning',
                    'message' => "Wrapper missing: {$path}",
                ];

                continue;
            }

            $perms = fileperms($path) & 0777;
            if ($perms !== 0755) {
                $issues[] = [
                    'severity' => 'warning',
                    'message' => "Wrapper {$path} should be mode 0755, found ".decoct($perms),
                ];
            }
        }

        if (! is_file('/etc/sudoers.d/beacon-panel')) {
            $issues[] = [
                'severity' => 'critical',
                'message' => 'Missing /etc/sudoers.d/beacon-panel — panel cannot manage the host.',
            ];
        }

        $beaconSudo = $this->runner->run(['sudo', '-l', '-U', 'beacon']);
        if ($beaconSudo->successful() && trim($beaconSudo->output()) !== '') {
            $issues[] = [
                'severity' => 'critical',
                'message' => 'Site user beacon must not have sudo privileges.',
            ];
        }

        $panelCurrent = (string) config('beacon.paths.panel_current');
        if (is_link($panelCurrent)) {
            $ownerUid = fileowner($panelCurrent);
            if ($ownerUid !== false) {
                $ownerInfo = posix_getpwuid($ownerUid);
                $owner = $ownerInfo['name'] ?? null;
                if ($owner !== null && $owner !== 'root') {
                    $issues[] = [
                        'severity' => 'warning',
                        'message' => "Panel release symlink should be root-owned (found {$owner}).",
                    ];
                }
            }
        }

        $ramMb = $this->totalMemoryMb();
        $swapMb = $this->swapTotalMb();
        if ($ramMb > 0 && $ramMb < 4096 && $swapMb === 0) {
            $issues[] = [
                'severity' => 'warning',
                'message' => 'No swap detected on a host with less than 4 GB RAM — builds may OOM.',
            ];
        }

        $disk = disk_free_space('/');
        if ($disk !== false && $disk < 5 * 1024 * 1024 * 1024) {
            $issues[] = [
                'severity' => 'warning',
                'message' => 'Less than 5 GB free disk space on /.',
            ];
        }

        return $issues;
    }

    /**
     * @return list<array{severity: string, message: string}>
     */
    private function provisionedRuntimeChecks(): array
    {
        if (app()->environment('testing')) {
            return [];
        }

        $issues = [];

        foreach (config('beacon.php_versions', []) as $version) {
            if (! is_dir("/etc/php/{$version}")) {
                $issues[] = [
                    'severity' => 'warning',
                    'message' => "PHP {$version} is not installed — site provisioning may fail.",
                ];
            }
        }

        if (! is_executable('/usr/local/node/default/bin/node')) {
            $issues[] = [
                'severity' => 'warning',
                'message' => 'Default Node.js runtime missing at /usr/local/node/default/bin/node.',
            ];
        }

        if (! is_executable('/usr/local/bun/default/bin/bun')) {
            $issues[] = [
                'severity' => 'warning',
                'message' => 'Bun runtime missing at /usr/local/bun/default/bin/bun.',
            ];
        }

        return $issues;
    }

    /**
     * @return list<array{severity: string, message: string}>
     */
    private function runtimeChecks(): array
    {
        if (app()->environment('testing')) {
            return [];
        }

        $issues = [];

        try {
            Redis::connection()->ping();
        } catch (\Throwable $e) {
            $issues[] = [
                'severity' => 'critical',
                'message' => 'Redis is unreachable — queues, cache locks, and deploy mutexes require Redis.',
            ];
        }

        return $issues;
    }

    private function totalMemoryMb(): int
    {
        if (! is_readable('/proc/meminfo')) {
            return 0;
        }

        foreach (file('/proc/meminfo', FILE_IGNORE_NEW_LINES) ?: [] as $line) {
            if (preg_match('/^MemTotal:\s+(\d+)/', $line, $matches)) {
                return (int) ($matches[1] / 1024);
            }
        }

        return 0;
    }

    private function swapTotalMb(): int
    {
        if (! is_readable('/proc/meminfo')) {
            return 0;
        }

        foreach (file('/proc/meminfo', FILE_IGNORE_NEW_LINES) ?: [] as $line) {
            if (preg_match('/^SwapTotal:\s+(\d+)/', $line, $matches)) {
                return (int) ($matches[1] / 1024);
            }
        }

        return 0;
    }
}
