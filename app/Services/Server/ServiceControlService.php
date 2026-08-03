<?php

namespace App\Services\Server;

use App\Services\System\ProcessRunner;
use App\Services\System\SudoWrapper;
use Illuminate\Support\Facades\Cache;
use RuntimeException;

class ServiceControlService
{
    public function __construct(private readonly ProcessRunner $runner) {}

    /**
     * @return array<int, array{unit: string, label: string, active_state: string, sub_state: string, main_pid: int|null, status: string}>
     */
    public function list(): array
    {
        return array_values(array_map(
            fn (string $unit): array => $this->describe($unit),
            config('beacon.allowed_units', []),
        ));
    }

    /**
     * @return array{unit: string, label: string, active_state: string, sub_state: string, main_pid: int|null, status: string}
     */
    public function describe(string $unit): array
    {
        $this->assertAllowedUnit($unit);

        $result = $this->runner->run([
            'systemctl', 'show', '-p', 'ActiveState,SubState,MainPID', '--value', $unit,
        ]);

        $parts = preg_split('/\s+/', trim($result->output())) ?: [];
        $activeState = $parts[0] ?? 'unknown';
        $subState = $parts[1] ?? 'unknown';
        $mainPid = isset($parts[2]) && is_numeric($parts[2]) ? (int) $parts[2] : null;

        return [
            'unit' => $unit,
            'label' => $this->labelFor($unit),
            'active_state' => $activeState,
            'sub_state' => $subState,
            'main_pid' => $mainPid,
            'status' => $this->mapStatus($activeState, $subState),
        ];
    }

    public function restart(string $unit): void
    {
        $this->assertAllowedUnit($unit);

        $result = $this->runner->sudoRoot(
            SudoWrapper::Service,
            ['restart', $unit],
            timeout: 120,
        );

        if ($result->failed()) {
            throw new RuntimeException("Failed to restart {$unit}: {$result->errorOutput()}");
        }

        Cache::forget('beacon:services:list');
    }

    private function assertAllowedUnit(string $unit): void
    {
        if (! in_array($unit, config('beacon.allowed_units', []), true)) {
            throw new RuntimeException("Service unit [{$unit}] is not allowed.");
        }
    }

    private function labelFor(string $unit): string
    {
        return match ($unit) {
            'nginx' => 'Nginx',
            'mysql' => 'MySQL',
            'redis-server' => 'Redis',
            'supervisor' => 'Supervisor',
            default => strtoupper(str_replace('-fpm', ' FPM', str_replace('php', 'PHP ', $unit))),
        };
    }

    private function mapStatus(string $activeState, string $subState): string
    {
        if ($activeState === 'active' && $subState === 'running') {
            return 'running';
        }

        if ($activeState === 'failed') {
            return 'failed';
        }

        if (in_array($activeState, ['inactive', 'dead'], true)) {
            return 'stopped';
        }

        return 'warning';
    }
}
