import { Head, router, usePoll } from '@inertiajs/react';
import { Code2, Cpu, HardDrive, MemoryStick, RefreshCw, Timer } from 'lucide-react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { PageHeader } from '@/components/console/page-header';
import { Panel, SpecList } from '@/components/console/panel';
import { HealthBanner } from '@/components/health-banner';
import { StatusPill, toStatus } from '@/components/status-pill';
import { Button } from '@/components/ui/button';
import {
    DataTable,
    TableBody,
    TableCell,
    TableHead,
    TableHeaderCell,
    TableRow,
} from '@/components/ui/data-table';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import { restart as restartService } from '@/routes/services';

type MetricsPayload = {
    server: { hostname: string; beacon_version: string | null };
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

type ServiceRow = {
    unit: string;
    label: string;
    active_state: string;
    sub_state: string;
    main_pid: number | null;
    status: string;
};

type PhpVersionRow = {
    id: number;
    version: string;
    status: string;
    is_default: boolean;
    installed_at: string | null;
};

function gib(mb: number): string {
    return `${(mb / 1024).toFixed(1)} GiB`;
}

function uptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
        return `${days}d ${hours}h`;
    }

    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

/** Inline SVG trend — no chart library, no axes, decorative only. */
function Sparkline({
    points,
    className,
}: {
    points: number[];
    className?: string;
}) {
    const max = Math.max(...points, 1);
    const min = Math.min(...points, 0);
    const range = max - min || 1;

    const path = points
        .map((value, index) => {
            const x = (index / (points.length - 1)) * 100;
            const y = 100 - ((value - min) / range) * 100;

            return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
        })
        .join(' ');

    return (
        <svg
            className={className}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
        >
            <path
                d={path}
                fill="none"
                stroke="var(--bc-chart-1)"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

/**
 * A utilisation gauge.
 *
 * Threshold colour is paired with the numeric percentage and a text label, so
 * the reading survives greyscale — a bar that is only red is not a signal.
 */
function Gauge({
    label,
    icon: Icon,
    percent,
    detail,
    series,
}: {
    label: string;
    icon: typeof Cpu;
    percent: number;
    detail: string;
    series?: number[];
}) {
    const clamped = Math.min(100, Math.max(0, percent));
    const level = clamped >= 90 ? 'danger' : clamped >= 75 ? 'warning' : 'ok';

    const tone = {
        ok: 'text-fg-strong',
        warning: 'text-fg-warning',
        danger: 'text-fg-danger',
    }[level];

    const fill = {
        ok: 'bg-[var(--bc-bg-brand)]',
        warning: 'bg-[var(--bc-bg-warning)]',
        danger: 'bg-[var(--bc-bg-danger)]',
    }[level];

    return (
        <div className="flex flex-col gap-3 px-5 py-4">
            <div className="flex items-center gap-2">
                <Icon
                    aria-hidden="true"
                    strokeWidth={1.5}
                    className="size-3.5 text-fg-disabled"
                />
                <span className="text-overline font-mono text-fg-subtle">
                    {label}
                </span>
                {level !== 'ok' && (
                    <span
                        className={cn(
                            'text-overline ms-auto font-mono',
                            level === 'danger'
                                ? 'text-fg-danger'
                                : 'text-fg-warning',
                        )}
                    >
                        {level === 'danger' ? 'critical' : 'high'}
                    </span>
                )}
            </div>

            <div className="flex items-end justify-between gap-3">
                {/* Values change, they never count up — during an incident a
                 * tweened number is wrong for the length of the tween. */}
                <p className={cn('text-metric-lg tabular-nums', tone)}>
                    {clamped.toFixed(0)}
                    <span className="text-[16px] font-normal text-fg-subtle">
                        %
                    </span>
                </p>

                {series && series.length > 1 && (
                    <Sparkline points={series} className="mb-1 h-8 w-24" />
                )}
            </div>

            <div>
                <div
                    className="h-1 w-full overflow-hidden rounded-full bg-[var(--bc-bg-subtle)]"
                    role="progressbar"
                    aria-valuenow={Math.round(clamped)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${label} utilisation`}
                >
                    <div
                        className={cn(
                            'h-full rounded-full transition-[width]',
                            fill,
                        )}
                        style={{ width: `${clamped}%` }}
                    />
                </div>
                <p className="text-caption mt-1.5 font-mono text-fg-subtle">
                    {detail}
                </p>
            </div>
        </div>
    );
}

export default function Dashboard({
    metrics,
    sparkline,
    services,
    phpVersions,
}: {
    metrics: MetricsPayload;
    sparkline: SparklinePoint[];
    services: ServiceRow[];
    phpVersions: PhpVersionRow[];
}) {
    usePoll(5000, { only: ['metrics'] });

    const m = metrics.metrics;
    const memoryPercent =
        m.memory_total_mb > 0 ? (m.memory_used_mb / m.memory_total_mb) * 100 : 0;
    const diskPercent =
        m.disk_total_mb > 0 ? (m.disk_used_mb / m.disk_total_mb) * 100 : 0;

    const running = services.filter((service) => service.status === 'running')
        .length;
    const degraded = services.length - running;

    return (
        <>
            <Head title="Dashboard" />

            <div className="flex flex-col gap-8 px-6 py-6">
                <PageHeader
                    eyebrow="overview"
                    title="Mission control"
                    description={
                        <>
                            <span className="font-mono">
                                {metrics.server.hostname}
                            </span>
                            {metrics.server.beacon_version && (
                                <>
                                    {' · '}
                                    <span className="font-mono">
                                        v{metrics.server.beacon_version}
                                    </span>
                                </>
                            )}
                            {' · up '}
                            <span className="font-mono">
                                {uptime(m.uptime_seconds)}
                            </span>
                        </>
                    }
                />

                <HealthBanner />

                {/* Utilisation strip — one panel, four gauges, dividers only. */}
                <Panel eyebrow="server // utilisation" flush>
                    <div className="grid divide-y divide-[var(--bc-border-subtle)] sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
                        <Gauge
                            label="CPU"
                            icon={Cpu}
                            percent={m.cpu_percent}
                            detail={`load ${m.load_1.toFixed(2)} · ${m.load_5.toFixed(2)} · ${m.load_15.toFixed(2)}`}
                            series={sparkline.map((point) => point.cpu_percent)}
                        />
                        <Gauge
                            label="Memory"
                            icon={MemoryStick}
                            percent={memoryPercent}
                            detail={`${gib(m.memory_used_mb)} of ${gib(m.memory_total_mb)}`}
                            series={sparkline.map(
                                (point) => point.memory_used_mb,
                            )}
                        />
                        <Gauge
                            label="Disk"
                            icon={HardDrive}
                            percent={diskPercent}
                            detail={`${gib(m.disk_used_mb)} of ${gib(m.disk_total_mb)}`}
                        />
                        <Gauge
                            label="Swap"
                            icon={Timer}
                            percent={
                                m.swap_total_mb && m.swap_total_mb > 0
                                    ? (m.swap_used_mb / m.swap_total_mb) * 100
                                    : 0
                            }
                            detail={
                                m.swap_total_mb && m.swap_total_mb > 0
                                    ? `${gib(m.swap_used_mb)} of ${gib(m.swap_total_mb)}`
                                    : 'no swap configured'
                            }
                        />
                    </div>
                </Panel>

                <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
                    <Panel
                        eyebrow="server // services"
                        title="Services"
                        description={
                            degraded > 0
                                ? `${running} running, ${degraded} not running.`
                                : `All ${running} services running.`
                        }
                        flush
                    >
                        <DataTable>
                            <TableHead>
                                <TableRow>
                                    <TableHeaderCell>Unit</TableHeaderCell>
                                    <TableHeaderCell>State</TableHeaderCell>
                                    <TableHeaderCell numeric>PID</TableHeaderCell>
                                    <TableHeaderCell>Status</TableHeaderCell>
                                    <TableHeaderCell />
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {services.map((service) => (
                                    <TableRow key={service.unit} interactive>
                                        <TableCell>
                                            <span className="font-medium text-fg">
                                                {service.label}
                                            </span>
                                            <span className="ms-2 font-mono text-[12px] text-fg-disabled">
                                                {service.unit}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="font-mono text-[13px] text-fg-muted">
                                                {service.active_state}/
                                                {service.sub_state}
                                            </span>
                                        </TableCell>
                                        <TableCell numeric>
                                            {service.main_pid ?? '—'}
                                        </TableCell>
                                        <TableCell>
                                            <StatusPill
                                                status={toStatus(service.status)}
                                                label={service.status}
                                                size="sm"
                                            />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <ConfirmDialog
                                                trigger={
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        aria-label={`Restart ${service.label}`}
                                                    >
                                                        <RefreshCw className="size-3.5" />
                                                        Restart
                                                    </Button>
                                                }
                                                title={`Restart ${service.label}?`}
                                                description="This briefly interrupts connections to the service."
                                                confirmLabel="Restart"
                                                onConfirm={() =>
                                                    router.post(
                                                        restartService.url(
                                                            service.unit,
                                                        ),
                                                    )
                                                }
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </DataTable>
                    </Panel>

                    <div className="flex flex-col gap-4">
                        <Panel
                            eyebrow="server // runtimes"
                            title="PHP"
                            icon={Code2}
                            flush
                        >
                            {phpVersions.length === 0 ? (
                                <p className="px-6 py-5 text-[14px] leading-[22px] text-fg-muted">
                                    No PHP versions detected on this host yet.
                                </p>
                            ) : (
                                <DataTable density="dense">
                                    <TableBody>
                                        {phpVersions.map((version) => (
                                            <TableRow key={version.id}>
                                                <TableCell>
                                                    <span className="font-mono text-[14px] font-medium text-fg">
                                                        {version.version}
                                                    </span>
                                                    {version.is_default && (
                                                        <span className="text-overline ms-2 font-mono text-fg-brand">
                                                            default
                                                        </span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <StatusPill
                                                        status={toStatus(
                                                            version.status,
                                                        )}
                                                        label={version.status}
                                                        size="sm"
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </DataTable>
                            )}
                        </Panel>

                        <Panel eyebrow="server // host" title="Host">
                            <SpecList
                                columns={2}
                                items={[
                                    {
                                        label: 'Hostname',
                                        value: metrics.server.hostname,
                                    },
                                    {
                                        label: 'Beacon',
                                        value: metrics.server.beacon_version ?? '—',
                                    },
                                    {
                                        label: 'Uptime',
                                        value: uptime(m.uptime_seconds),
                                    },
                                    {
                                        label: 'Load (1m)',
                                        value: m.load_1.toFixed(2),
                                    },
                                ]}
                            />
                        </Panel>
                    </div>
                </div>
            </div>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [{ title: 'Dashboard', href: dashboard() }],
};
