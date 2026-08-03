import { Head, router } from '@inertiajs/react';
import { RefreshCw } from 'lucide-react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { PageHeader } from '@/components/console/page-header';
import { Panel, StatCluster } from '@/components/console/panel';
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
import {
    index as servicesIndex,
    restart as restartService,
} from '@/routes/services';

type ServiceRow = {
    unit: string;
    label: string;
    active_state: string;
    sub_state: string;
    main_pid: number | null;
    status: string;
};

export default function ServicesIndex({
    services,
}: {
    services: ServiceRow[];
}) {
    const running = services.filter((service) => service.status === 'running')
        .length;
    const stopped = services.length - running;

    return (
        <>
            <Head title="Services" />

            <div className="flex flex-col gap-8 px-6 py-6">
                <PageHeader
                    eyebrow="server // services"
                    title="Services"
                    description="The systemd units Beacon is allowed to control. Reading status needs no privileges; restarting goes through a restricted sudo wrapper."
                />

                <HealthBanner />

                <StatCluster
                    className="max-w-lg"
                    stats={[
                        { label: 'Units', value: services.length },
                        { label: 'Running', value: running, tone: 'success' },
                        {
                            label: 'Stopped',
                            value: stopped,
                            tone: stopped > 0 ? 'warning' : 'default',
                        },
                    ]}
                />

                <Panel eyebrow="systemd // units" flush>
                    <DataTable>
                        <TableHead>
                            <TableRow>
                                <TableHeaderCell>Service</TableHeaderCell>
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
                                    </TableCell>
                                    <TableCell>
                                        <span className="font-mono text-[13px] text-fg-muted">
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
                                                    variant="secondary"
                                                    aria-label={`Restart ${service.label}`}
                                                >
                                                    <RefreshCw className="size-3.5" />
                                                    Restart
                                                </Button>
                                            }
                                            title={`Restart ${service.label}?`}
                                            description="This briefly interrupts every connection the service is handling."
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
            </div>
        </>
    );
}

ServicesIndex.layout = {
    breadcrumbs: [{ title: 'Services', href: servicesIndex() }],
};
