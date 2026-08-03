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

        // Key=Value, not --value.
        //
        // `systemctl show -p A,B,C --value` prints bare values in systemd's own
        // order, which is not the order they were requested in. Reading them
        // positionally put MainPID in the ActiveState slot, so the UI showed
        // "62010/active" as the state and an empty PID for every unit.
        $result = $this->runner->run([
            'systemctl', 'show', $unit,
            '--property=ActiveState',
            '--property=SubState',
            '--property=MainPID',
        ]);

        $values = [];

        foreach (preg_split('/\R/', trim($result->output())) ?: [] as $line) {
            if (! str_contains($line, '=')) {
                continue;
            }

            [$key, $value] = explode('=', $line, 2);
            $values[trim($key)] = trim($value);
        }

        $activeState = $values['ActiveState'] ?? 'unknown';
        $subState = $values['SubState'] ?? 'unknown';

        // systemd reports MainPID=0 for a unit that is not running.
        $rawPid = $values['MainPID'] ?? '';
        $mainPid = ctype_digit($rawPid) && $rawPid !== '0' ? (int) $rawPid : null;

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
