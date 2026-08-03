import { Head, router } from '@inertiajs/react';
import { RefreshCw, Wrench } from 'lucide-react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import Heading from '@/components/heading';
import { HealthBanner } from '@/components/health-banner';
import { ServiceStatusDot } from '@/components/service-status-dot';
import { StatusBadge } from '@/components/status-badge';
import type { Status } from '@/components/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
    return (
        <>
            <Head title="Services" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <HealthBanner />
                <Heading
                    title="Services"
                    description="Monitor core stack services and restart them when needed"
                />

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {services.map((service) => (
                        <Card key={service.unit} className="py-4">
                            <CardContent className="flex flex-col gap-3 px-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-2">
                                        <Wrench className="size-4 text-muted-foreground" />
                                        <div>
                                            <p className="font-medium">
                                                {service.label}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {service.unit}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <ServiceStatusDot
                                            status={service.status}
                                        />
                                        <StatusBadge
                                            status={service.status as Status}
                                            label={service.status}
                                        />
                                    </div>
                                </div>

                                <p className="text-sm text-muted-foreground">
                                    {service.active_state} / {service.sub_state}
                                    {service.main_pid
                                        ? ` · pid ${service.main_pid}`
                                        : ''}
                                </p>

                                <ConfirmDialog
                                    trigger={
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-fit"
                                        >
                                            <RefreshCw className="size-3.5" />
                                            Restart
                                        </Button>
                                    }
                                    title={`Restart ${service.label}?`}
                                    description="Connections to this service will drop briefly during the restart."
                                    confirmLabel="Restart"
                                    onConfirm={() =>
                                        router.post(
                                            restartService.url(service.unit),
                                        )
                                    }
                                />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </>
    );
}

ServicesIndex.layout = {
    breadcrumbs: [{ title: 'Services', href: servicesIndex() }],
};
