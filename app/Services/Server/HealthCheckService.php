<?php

namespace App\Services\Server;

use App\Services\System\ProcessRunner;
use App\Services\System\SudoWrapper;
use Illuminate\Support\Facades\Cache;
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
            $issues = [...$issues, ...$this->nginxGlobalChecks()];
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
     * Can the panel actually drive the host?
     *
     * This asks the only question that matters — does a wrapper call succeed —
     * rather than inspecting file modes. Inspecting was wrong twice over:
     *
     *  - `is_writable('/etc/nginx')` is *supposed* to be false. The panel user
     *    never writes there directly; every write goes through a root wrapper.
     *  - `is_file('/etc/sudoers.d/beacon-panel')` is false even when the file
     *    exists, because /etc/sudoers.d is 0750 root:root and beacon-panel
     *    cannot stat inside it.
     *
     * Both reported a healthy server as broken. `beacon-nginx test` is
     * read-only, cheap, and exercises sudo, the wrapper and nginx in one go.
     *
     * @return list<array{severity: string, message: string}>
     */
    private function privilegeChecks(): array
    {
        // Cached hard, and separately from the rest of the health result.
        //
        // This is the only check that spawns a process, and health is shared
        // on every authenticated request — including the operations dock
        // polling every 1.5s. `nginx -t` also re-parses every vhost and reads
        // every certificate, so at the 30s cadence of the outer cache it would
        // add a subprocess to the critical path of a busy panel. Privileges do
        // not change minute to minute; fifteen minutes is plenty.
        return Cache::remember(
            'beacon:health:privileges',
            now()->addMinutes(15),
            fn (): array => $this->probePrivileges(),
        );
    }

    /**
     * @return list<array{severity: string, message: string}>
     */
    private function probePrivileges(): array
    {
        $result = $this->runner->run(
            ['sudo', '-n', SudoWrapper::Nginx->path(), 'test'],
            timeout: 8,
        );

        // 0 = config valid, 65 = nginx rejected the config. Either way sudo and
        // the wrapper worked, which is what is being tested here.
        if ($result->successful() || $result->exitCode() === 65) {
            return [];
        }

        $detail = trim($result->errorOutput().' '.$result->output());

        return [[
            'severity' => 'critical',
            'message' => 'The panel cannot run its privileged helpers. Re-run install.sh, '
                .'then check /etc/sudoers.d/beacon-panel and the ProtectSystem drop-in.'
                .($detail !== '' ? ' Reported: '.mb_substr($detail, 0, 200) : ''),
        ]];
    }

    /**
     * @return list<array{severity: string, message: string}>
     */
    private function hostChecks(): array
    {
        $issues = [...$this->privilegeChecks()];

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

        // /etc/sudoers.d is 0750 root:root, so the panel user cannot stat inside
        // it. Whether sudo works at all is covered by privilegeChecks() above.

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
    private function nginxGlobalChecks(): array
    {
        if (app()->environment('testing')) {
            return [];
        }

        $path = '/etc/nginx/conf.d/beacon-global.conf';

        if (! is_readable($path)) {
            return [[
                'severity' => 'critical',
                'message' => 'Missing /etc/nginx/conf.d/beacon-global.conf — full page loads may 502 with "upstream sent too big header". Re-run install.sh or deploy a current panel release.',
            ]];
        }

        $contents = (string) file_get_contents($path);

        if (! preg_match('/^\s*fastcgi_buffer_size\s+32k\s*;/m', $contents)) {
            return [[
                'severity' => 'critical',
                'message' => 'nginx fastcgi_buffer_size is not 32k in beacon-global.conf — the site detail page can 502 on refresh. Re-run install.sh or update the panel.',
            ]];
        }

        return [];
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
