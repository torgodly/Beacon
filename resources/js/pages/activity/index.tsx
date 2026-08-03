import { Head } from '@inertiajs/react';
import { Activity } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState, PageHeader } from '@/components/console/page-header';
import { Panel } from '@/components/console/panel';
import { StatusPill  } from '@/components/status-pill';
import type {BeaconStatus} from '@/components/status-pill';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
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

function toneStatus(tone: string): BeaconStatus {
    return (
        {
            success: 'live',
            info: 'deploying',
            warning: 'degraded',
            failed: 'failed',
        }[tone] ?? 'stopped'
    ) as BeaconStatus;
}

function timestamp(iso: string | null): { time: string; date: string } {
    if (iso === null) {
        return { time: '--:--:--', date: '' };
    }

    const value = new Date(iso);

    return {
        time: value.toLocaleTimeString(undefined, { hour12: false }),
        date: value.toLocaleDateString(),
    };
}

export default function ActivityIndex({ logs }: { logs: ActivityRow[] }) {
    const [query, setQuery] = useState('');

    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();

        if (needle === '') {
            return logs;
        }

        return logs.filter((log) =>
            [log.event, log.label, log.description, log.user?.name]
                .filter(Boolean)
                .some((value) => String(value).toLowerCase().includes(needle)),
        );
    }, [logs, query]);

    return (
        <>
            <Head title="Activity" />

            <div className="flex flex-col gap-8 px-6 py-6">
                <PageHeader
                    eyebrow="inspect // activity"
                    title="Activity"
                    description="Append-only audit trail of every panel action — deployments, configuration changes and provisioning."
                    actions={
                        <Input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Filter events…"
                            aria-label="Filter activity"
                            className="w-64"
                        />
                    }
                />

                {filtered.length === 0 ? (
                    <EmptyState
                        icon={Activity}
                        title={query ? 'No matching events' : 'No activity yet'}
                        description={
                            query
                                ? 'Try a different search term.'
                                : 'Actions taken in the panel will be recorded here.'
                        }
                    />
                ) : (
                    <Panel eyebrow="activity // stream" flush>
                        <ol className="divide-y divide-[var(--bc-border-subtle)]">
                            {filtered.map((log) => {
                                const stamp = timestamp(log.created_at);

                                return (
                                    <li
                                        key={log.id}
                                        className={cn(
                                            'flex flex-wrap items-start gap-x-4 gap-y-1.5 px-6 py-3.5',
                                            'transition-colors duration-[--bc-duration-fast] hover:bg-[var(--bc-bg-hover)]',
                                        )}
                                    >
                                        {/* Timestamps are mono and tabular so
                                          * the column stays scannable. */}
                                        <time
                                            dateTime={log.created_at ?? undefined}
                                            className="w-20 shrink-0 font-mono text-[13px] leading-5 tabular-nums text-fg-subtle"
                                            title={stamp.date}
                                        >
                                            {stamp.time}
                                        </time>

                                        <StatusPill
                                            status={toneStatus(log.tone)}
                                            label={log.label}
                                            size="sm"
                                            className="shrink-0"
                                        />

                                        <span className="min-w-0 flex-1">
                                            <span className="block text-[14px] leading-[22px] text-fg">
                                                {log.description ?? log.event}
                                            </span>
                                            <span className="text-caption font-mono text-fg-disabled">
                                                {log.event}
                                                {log.subject_type && (
                                                    <>
                                                        {' · '}
                                                        {log.subject_type
                                                            .split('\\')
                                                            .pop()}
                                                        #{log.subject_id}
                                                    </>
                                                )}
                                            </span>
                                        </span>

                                        <span className="shrink-0 text-[13px] leading-5 text-fg-muted">
                                            {log.user?.name ?? 'system'}
                                        </span>
                                    </li>
                                );
                            })}
                        </ol>
                    </Panel>
                )}
            </div>
        </>
    );
}

ActivityIndex.layout = {
    breadcrumbs: [{ title: 'Activity', href: activityIndex() }],
};
