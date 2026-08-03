import { Head } from '@inertiajs/react';
import { Activity } from 'lucide-react';
import Heading from '@/components/heading';
import { StatusBadge } from '@/components/status-badge';
import type { Status } from '@/components/status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { index as activityIndex } from '@/routes/activity';

type ActivityRow = {
    id: number;
    event: string;
    label: string;
    tone: string;
    description: string | null;
    properties: Record<string, unknown> | null;
    user: { name: string; email: string } | null;
    subject_type: string | null;
    subject_id: number | null;
    created_at: string | null;
};

function toneStatus(tone: string): Status {
    return ({
        success: 'success',
        info: 'info',
        warning: 'pending',
        failed: 'failed',
    }[tone] ?? 'info') as Status;
}

export default function ActivityIndex({ logs }: { logs: ActivityRow[] }) {
    return (
        <>
            <Head title="Activity" />
            <div className="flex h-full flex-1 flex-col gap-4 p-4">
                <Heading
                    title="Activity"
                    description="Audit trail of panel actions — deployments, configuration changes, and provisioning."
                />

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Activity className="size-4" />
                            Recent events
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {logs.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                No activity recorded yet.
                            </p>
                        ) : (
                            logs.map((log) => (
                                <div
                                    key={log.id}
                                    className="flex flex-wrap items-start justify-between gap-3 rounded-lg border px-3 py-2 text-sm"
                                >
                                    <div className="flex min-w-0 flex-col gap-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-medium">
                                                {log.label}
                                            </span>
                                            <StatusBadge
                                                status={toneStatus(log.tone)}
                                                label={log.event}
                                            />
                                        </div>
                                        {log.description && (
                                            <span className="text-muted-foreground">
                                                {log.description}
                                            </span>
                                        )}
                                        {log.properties &&
                                            Object.keys(log.properties).length >
                                                0 && (
                                                <span className="font-mono text-xs text-muted-foreground">
                                                    {JSON.stringify(
                                                        log.properties,
                                                    )}
                                                </span>
                                            )}
                                        <span className="text-xs text-muted-foreground">
                                            {log.user
                                                ? `${log.user.name} · ${log.user.email}`
                                                : 'System'}
                                        </span>
                                    </div>
                                    <span className="shrink-0 text-xs text-muted-foreground">
                                        {log.created_at
                                            ? new Date(
                                                  log.created_at,
                                              ).toLocaleString()
                                            : 'Unknown time'}
                                    </span>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>
        </>
    );
}

ActivityIndex.layout = {
    breadcrumbs: [{ title: 'Activity', href: activityIndex() }],
};
