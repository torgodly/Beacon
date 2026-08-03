<?php

namespace App\Services\Server;

use App\Models\Server;
use App\Models\ServerMetric;
use Illuminate\Support\Facades\Cache;

class ServerMetricsService
{
    private const int CACHE_SECONDS = 2;

    private const int RETENTION_HOURS = 48;

    public function __construct(private readonly SystemMetricsReader $reader) {}

    /**
     * @return array<string, mixed>
     */
    public function current(?Server $server = null): array
    {
        $server ??= Server::current();

        return Cache::remember(
            "beacon:metrics:current:{$server->id}",
            self::CACHE_SECONDS,
            fn (): array => $this->format($server, $this->reader->collect()),
        );
    }

    public function record(Server $server): ServerMetric
    {
        $metrics = $this->reader->collect();
        unset($metrics['swap_total_mb']);

        return ServerMetric::query()->create([
            'server_id' => $server->id,
            ...$metrics,
            'recorded_at' => now(),
        ]);
    }

    public function prune(Server $server): int
    {
        return ServerMetric::query()
            ->where('server_id', $server->id)
            ->where('recorded_at', '<', now()->subHours(self::RETENTION_HOURS))
            ->delete();
    }

    /**
     * @return array<int, array{
     *     recorded_at: string,
     *     cpu_percent: float,
     *     memory_used_mb: int,
     *     disk_used_mb: int,
     *     load_1: float
     * }>
     */
    public function sparkline(Server $server, int $hours = 24): array
    {
        return array_values(ServerMetric::query()
            ->where('server_id', $server->id)
            ->where('recorded_at', '>=', now()->subHours($hours))
            ->orderBy('recorded_at')
            ->get(['recorded_at', 'cpu_percent', 'memory_used_mb', 'disk_used_mb', 'load_1'])
            ->map(fn (ServerMetric $metric): array => [
                'recorded_at' => $metric->recorded_at->toIso8601String(),
                'cpu_percent' => (float) $metric->cpu_percent,
                'memory_used_mb' => (int) $metric->memory_used_mb,
                'disk_used_mb' => (int) $metric->disk_used_mb,
                'load_1' => (float) $metric->load_1,
            ])
            ->all());
    }

    /**
     * @param  array<string, mixed>  $metrics
     * @return array<string, mixed>
     */
    private function format(Server $server, array $metrics): array
    {
        return [
            'server' => [
                'hostname' => $server->hostname,
                'beacon_version' => $server->beacon_version,
            ],
            'metrics' => $metrics,
            'recorded_at' => now()->toIso8601String(),
        ];
    }
}
