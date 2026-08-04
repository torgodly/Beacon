import { Head } from '@inertiajs/react';
import { Activity } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/console/page-header';
import {
    ForgeDividedCard,
    ForgeListRow,
} from '@/components/forge/forge-divided-card';
import {
    ForgeDetailRow,
    ForgeDetailsSection,
    ForgePageLayout,
} from '@/components/forge/forge-details-sidebar';
import { Input } from '@/components/ui/input';
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

function timeAgo(iso: string | null): string {
    if (!iso) {
        return 'Unknown';
    }

    const diff = Date.now() - new Date(iso).getTime();
    const hours = Math.floor(diff / 3_600_000);

    if (hours < 1) {
        return 'Just now';
    }

    if (hours < 24) {
        return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    }

    const days = Math.floor(hours / 24);

    return `${days} day${days === 1 ? '' : 's'} ago`;
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

            <ForgePageLayout
                main={
                    <>
                        <Input
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Filter events…"
                            aria-label="Filter activity"
                            className="max-w-md"
                        />

                        {filtered.length === 0 ? (
                            <EmptyState
                                icon={Activity}
                                title={
                                    query ? 'No matching events' : 'No activity yet'
                                }
                                description={
                                    query
                                        ? 'Try a different search term.'
                                        : 'Actions taken in the panel will be recorded here.'
                                }
                            />
                        ) : (
                            <ForgeDividedCard title="Activity">
                                {filtered.map((log) => (
                                    <ForgeListRow
                                        key={log.id}
                                        className="items-start"
                                    >
                                        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#f1f5f9] dark:bg-[#2e3032]">
                                            <Activity className="size-4 text-[#18B69B]" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium text-[#0f172a] dark:text-[#f8fafc]">
                                                {log.label}
                                            </p>
                                            <p className="text-sm text-[#64748b]">
                                                {log.description ?? log.event}
                                            </p>
                                            <p className="mt-1 font-mono text-xs text-[#94a3b8]">
                                                {timeAgo(log.created_at)} by{' '}
                                                {log.user?.name ?? 'Beacon'}
                                            </p>
                                        </div>
                                    </ForgeListRow>
                                ))}
                            </ForgeDividedCard>
                        )}
                    </>
                }
                sidebar={
                    <ForgeDetailsSection title="Activity">
                        <ForgeDetailRow
                            label="Total events"
                            value={String(logs.length)}
                        />
                        <ForgeDetailRow
                            label="Showing"
                            value={String(filtered.length)}
                        />
                    </ForgeDetailsSection>
                }
            />
        </>
    );
}

ActivityIndex.layout = {
    breadcrumbs: [{ title: 'Activity', href: activityIndex() }],
};
