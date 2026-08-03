import { Cpu, HardDrive, MemoryStick, Timer } from 'lucide-react';
import { MetricSparklineCard } from '@/components/metric-sparkline-card';

type MetricsPayload = {
    server: {
        hostname: string;
        beacon_version: string | null;
    };
    metrics: {
        cpu_percent: number;
        memory_used_mb: number;
        memory_total_mb: number;
        swap_used_mb: number;
        swap_total_mb?: number;
        disk_used_mb: number;
        disk_total_mb: number;
        load_1: number;
        load_5: number;
        load_15: number;
        uptime_seconds: number;
    };
    recorded_at: string;
};

type SparklinePoint = {
    recorded_at: string;
    cpu_percent: number;
    memory_used_mb: number;
    disk_used_mb: number;
    load_1: number;
};

function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
        return `${days}d ${hours}h`;
    }

    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }

    return `${minutes}m`;
}

function percent(used: number, total: number): string {
    if (total <= 0) {
        return '—';
    }

    return `${Math.round((used / total) * 100)}%`;
}

function toSeries(
    sparkline: SparklinePoint[],
    selector: (point: SparklinePoint) => number,
): Array<{ value: number }> {
    return sparkline.map((point) => ({ value: selector(point) }));
}

export function ServerMetricsGrid({
    payload,
    sparkline = [],
}: {
    payload: MetricsPayload;
    sparkline?: SparklinePoint[];
}) {
    const { metrics, server } = payload;
    const memoryPercent =
        metrics.memory_total_mb > 0
            ? (metrics.memory_used_mb / metrics.memory_total_mb) * 100
            : 0;
    const diskPercent =
        metrics.disk_total_mb > 0
            ? (metrics.disk_used_mb / metrics.disk_total_mb) * 100
            : 0;

    return (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricSparklineCard
                label="CPU"
                icon={Cpu}
                color="emerald"
                value={`${metrics.cpu_percent.toFixed(1)}%`}
                hint={`Load ${metrics.load_1} · ${metrics.load_5} · ${metrics.load_15}`}
                data={toSeries(sparkline, (point) => point.cpu_percent)}
            />
            <MetricSparklineCard
                label="Memory"
                icon={MemoryStick}
                color="indigo"
                value={`${metrics.memory_used_mb} MB`}
                hint={`${percent(metrics.memory_used_mb, metrics.memory_total_mb)} of ${metrics.memory_total_mb} MB`}
                data={toSeries(sparkline, () => memoryPercent)}
            />
            <MetricSparklineCard
                label="Load average"
                icon={Timer}
                color="violet"
                value={metrics.load_1.toFixed(2)}
                hint={`5m ${metrics.load_5} · 15m ${metrics.load_15}`}
                data={toSeries(sparkline, (point) => point.load_1)}
            />
            <MetricSparklineCard
                label="Disk"
                icon={HardDrive}
                color="amber"
                value={`${metrics.disk_used_mb} MB`}
                hint={`${percent(metrics.disk_used_mb, metrics.disk_total_mb)} of ${metrics.disk_total_mb} MB · up ${formatUptime(metrics.uptime_seconds)} · ${server.hostname}`}
                data={toSeries(sparkline, () => diskPercent)}
            />
        </div>
    );
}

export type { MetricsPayload, SparklinePoint };
