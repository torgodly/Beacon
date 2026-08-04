import { Head, router } from '@inertiajs/react';
import { RefreshCw } from 'lucide-react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { HealthBanner } from '@/components/health-banner';
import {
    ForgeDividedCard,
    ForgeListRow,
} from '@/components/forge/forge-divided-card';
import {
    ForgeDetailRow,
    ForgeDetailsSection,
    ForgePageLayout,
} from '@/components/forge/forge-details-sidebar';
import { ForgeStatusBadge } from '@/components/forge/forge-badge';
import { Button } from '@/components/ui/button';
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

    return (
        <>
            <Head title="Services" />

            <div className="mb-6">
                <HealthBanner />
            </div>

            <ForgePageLayout
                main={
                    <ForgeDividedCard title="System services">
                        {services.map((service) => (
                            <ForgeListRow key={service.unit}>
                                <div className="min-w-0 flex-1">
                                    <p className="font-medium text-[#0f172a] dark:text-[#f8fafc]">
                                        {service.label}
                                    </p>
                                    <p className="truncate font-mono text-xs text-[#64748b]">
                                        {service.unit}
                                    </p>
                                </div>
                                <span className="hidden font-mono text-xs text-[#64748b] sm:inline">
                                    {service.active_state}/{service.sub_state}
                                    {service.main_pid
                                        ? ` · pid ${service.main_pid}`
                                        : ''}
                                </span>
                                <ForgeStatusBadge
                                    label={service.status}
                                    pulse={service.status === 'running'}
                                />
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
                                            restartService.url(service.unit),
                                        )
                                    }
                                />
                            </ForgeListRow>
                        ))}
                    </ForgeDividedCard>
                }
                sidebar={
                    <ForgeDetailsSection title="Processes">
                        <ForgeDetailRow
                            label="Units"
                            value={String(services.length)}
                        />
                        <ForgeDetailRow
                            label="Running"
                            value={String(running)}
                        />
                        <ForgeDetailRow
                            label="Stopped"
                            value={String(services.length - running)}
                        />
                    </ForgeDetailsSection>
                }
            />
        </>
    );
}

ServicesIndex.layout = {
    breadcrumbs: [{ title: 'Services', href: servicesIndex() }],
};
