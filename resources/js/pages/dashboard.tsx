import { Head, router, usePoll } from '@inertiajs/react';
import { RefreshCw } from 'lucide-react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { HealthBanner } from '@/components/health-banner';
import type {
    MetricsPayload,
    SparklinePoint,
} from '@/components/server-metrics-grid';
import { ServerMetricsGrid } from '@/components/server-metrics-grid';
import { ServiceStatusDot } from '@/components/service-status-dot';
import { StatusBadge } from '@/components/status-badge';
import type { Status } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { dashboard } from '@/routes';
import { restart as restartService } from '@/routes/services';

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
    usePoll(5000, { only: ['metrics', 'sparkline'] });

    return (
        <>
            <Head title="Dashboard" />
            <div className="flex h-full flex-1 flex-col gap-6 overflow-x-auto p-4">
                <HealthBanner />

                {metrics ? (
                    <ServerMetricsGrid
                        payload={metrics}
                        sparkline={sparkline}
                    />
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <Skeleton key={index} className="h-36 rounded-xl" />
                        ))}
                    </div>
                )}

                <div className="grid gap-4 lg:grid-cols-2">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle className="text-base">
                                Services
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {services.map((service) => (
                                <div
                                    key={service.unit}
                                    className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                                >
                                    <div>
                                        <p className="font-medium">
                                            {service.label}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            {service.active_state} /{' '}
                                            {service.sub_state}
                                            {service.main_pid
                                                ? ` · pid ${service.main_pid}`
                                                : ''}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <ServiceStatusDot
                                            status={service.status}
                                        />
                                        <StatusBadge
                                            status={service.status as Status}
                                            label={service.status}
                                        />
                                        <ConfirmDialog
                                            trigger={
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                >
                                                    <RefreshCw className="size-3.5" />
                                                    Restart
                                                </Button>
                                            }
                                            title={`Restart ${service.label}?`}
                                            description="This will briefly interrupt connections to the service."
                                            confirmLabel="Restart"
                                            onConfirm={() =>
                                                router.post(
                                                    restartService.url(
                                                        service.unit,
                                                    ),
                                                )
                                            }
                                        />
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-base">
                                PHP versions
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {phpVersions.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    No PHP versions detected on this host yet.
                                </p>
                            ) : (
                                phpVersions.map((version) => (
                                    <div
                                        key={version.id}
                                        className="flex items-center justify-between rounded-lg border px-3 py-2"
                                    >
                                        <span className="font-medium">
                                            PHP {version.version}
                                            {version.is_default && (
                                                <span className="ml-2 text-xs text-muted-foreground">
                                                    default
                                                </span>
                                            )}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <ServiceStatusDot
                                                status={
                                                    version.status ===
                                                    'installed'
                                                        ? 'success'
                                                        : 'warning'
                                                }
                                            />
                                            <StatusBadge
                                                status={
                                                    version.status ===
                                                    'installed'
                                                        ? 'success'
                                                        : 'warning'
                                                }
                                                label={version.status}
                                            />
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [
        {
            title: 'Dashboard',
            href: dashboard(),
        },
    ],
};
