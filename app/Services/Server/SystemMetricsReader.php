<?php

namespace App\Services\Server;

/**
 * Reads host metrics from /proc and PHP helpers — locale-proof, no shell parsing.
 */
class SystemMetricsReader
{
    /** @var array{idle: int, total: int}|null */
    private ?array $lastCpuSample = null;

    /**
     * @return array{
     *     cpu_percent: float,
     *     memory_used_mb: int,
     *     memory_total_mb: int,
     *     swap_used_mb: int,
     *     swap_total_mb: int,
     *     disk_used_mb: int,
     *     disk_total_mb: int,
     *     load_1: float,
     *     load_5: float,
     *     load_15: float,
     *     uptime_seconds: int,
     * }
     */
    public function collect(): array
    {
        $memory = $this->readMemory();
        $disk = $this->readDisk('/');
        $load = sys_getloadavg() ?: [0.0, 0.0, 0.0];

        return [
            'cpu_percent' => $this->readCpuPercent(),
            'memory_used_mb' => $memory['used_mb'],
            'memory_total_mb' => $memory['total_mb'],
            'swap_used_mb' => $memory['swap_used_mb'],
            'swap_total_mb' => $memory['swap_total_mb'],
            'disk_used_mb' => $disk['used_mb'],
            'disk_total_mb' => $disk['total_mb'],
            'load_1' => round($load[0], 2),
            'load_5' => round($load[1], 2),
            'load_15' => round($load[2], 2),
            'uptime_seconds' => $this->readUptimeSeconds(),
        ];
    }

    private function readCpuPercent(): float
    {
        if (! is_readable('/proc/stat')) {
            return 0.0;
        }

        $first = $this->parseCpuLine((string) file_get_contents('/proc/stat'));

        if ($this->lastCpuSample === null) {
            usleep(200_000);
        }

        $second = $this->parseCpuLine((string) file_get_contents('/proc/stat'));
        $previous = $this->lastCpuSample ?? $first;
        $this->lastCpuSample = $second;

        $idleDelta = $second['idle'] - $previous['idle'];
        $totalDelta = $second['total'] - $previous['total'];

        if ($totalDelta <= 0) {
            return 0.0;
        }

        return round((1 - ($idleDelta / $totalDelta)) * 100, 2);
    }

    /**
     * @return array{idle: int, total: int}
     */
    private function parseCpuLine(string $stat): array
    {
        $line = strtok($stat, "\n") ?: '';

        if (! str_starts_with($line, 'cpu ')) {
            return ['idle' => 0, 'total' => 0];
        }

        $parts = array_map(intval(...), array_slice(explode(' ', preg_replace('/\s+/', ' ', trim($line))), 1));
        $idle = ($parts[3] ?? 0) + ($parts[4] ?? 0);
        $total = array_sum($parts);

        return compact('idle', 'total');
    }

    /**
     * @return array{used_mb: int, total_mb: int, swap_used_mb: int, swap_total_mb: int}
     */
    private function readMemory(): array
    {
        if (! is_readable('/proc/meminfo')) {
            return [
                'used_mb' => 0,
                'total_mb' => 0,
                'swap_used_mb' => 0,
                'swap_total_mb' => 0,
            ];
        }

        $info = [];
        foreach (file('/proc/meminfo', FILE_IGNORE_NEW_LINES) ?: [] as $line) {
            if (preg_match('/^(\w+):\s+(\d+)/', $line, $matches)) {
                $info[$matches[1]] = (int) $matches[2];
            }
        }

        $totalKb = $info['MemTotal'] ?? 0;
        $availableKb = $info['MemAvailable'] ?? ($info['MemFree'] ?? 0);
        $swapTotalKb = $info['SwapTotal'] ?? 0;
        $swapFreeKb = $info['SwapFree'] ?? 0;

        return [
            'used_mb' => (int) max(0, ($totalKb - $availableKb) / 1024),
            'total_mb' => (int) ($totalKb / 1024),
            'swap_used_mb' => (int) max(0, ($swapTotalKb - $swapFreeKb) / 1024),
            'swap_total_mb' => (int) ($swapTotalKb / 1024),
        ];
    }

    /**
     * @return array{used_mb: int, total_mb: int}
     */
    private function readDisk(string $path): array
    {
        $free = disk_free_space($path);
        $total = disk_total_space($path);

        if ($free === false || $total === false) {
            return ['used_mb' => 0, 'total_mb' => 0];
        }

        $used = max(0, $total - $free);

        return [
            'used_mb' => (int) ($used / 1024 / 1024),
            'total_mb' => (int) ($total / 1024 / 1024),
        ];
    }

    private function readUptimeSeconds(): int
    {
        if (! is_readable('/proc/uptime')) {
            return 0;
        }

        $parts = explode(' ', trim((string) file_get_contents('/proc/uptime')));

        return (int) $parts[0];
    }
}
