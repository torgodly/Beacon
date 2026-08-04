import { Head, Link } from '@inertiajs/react';
import { MoreHorizontal } from 'lucide-react';
import {
    ForgeDividedCard,
    ForgeListRow,
} from '@/components/forge/forge-divided-card';
import {
    ForgeDetailRow,
    ForgeDetailsSection,
    ForgePageLayout,
} from '@/components/forge/forge-details-sidebar';
import {
    ForgeFrameworkBadge,
    ForgeRuntimeBadge,
    ForgeStatusBadge,
} from '@/components/forge/forge-badge';
import { Button } from '@/components/ui/button';
import { SiteFrameworkIcon } from '@/components/sites/site-framework-icon';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import { index as sitesIndex, show as siteShow } from '@/routes/sites';

type OverviewSite = {
    id: string;
    name: string;
    type: string;
    repository: string | null;
    repository_branch: string;
    repository_connected: boolean;
    php_version: string | null;
    last_deployed_at: string | null;
};

type OverviewDatabase = { id: number; name: string; status: string };
type OverviewProcess = {
    id: number;
    name: string;
    command: string;
    status: string;
    site_name: string | null;
};
type OverviewCron = {
    id: number;
    name: string;
    command: string;
    frequency: string;
    enabled: boolean;
    site_name: string | null;
};
type OverviewActivity = {
    id: number;
    label: string;
    description: string | null;
    created_at: string | null;
    user_name: string;
};

function timeAgo(iso: string | null): string {
    if (!iso) {
        return 'Never';
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

function formatDate(iso: string | null): string {
    if (!iso) {
        return '—';
    }

    return new Date(iso).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

function RowMenu() {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className="rounded-md p-1.5 text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#475569] dark:hover:bg-[#2e3032]"
                    aria-label="Actions"
                >
                    <MoreHorizontal className="size-4" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem>Manage</DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export default function Dashboard({
    server,
    overview,
}: {
    server: {
        id: number;
        hostname: string;
        public_ip: string;
        site_user: string;
        created_at: string | null;
    };
    overview: {
        sites: OverviewSite[];
        databases: OverviewDatabase[];
        processes: OverviewProcess[];
        cronJobs: OverviewCron[];
        activity: OverviewActivity[];
    };
}) {
    return (
        <>
            <Head title="Overview" />

            <ForgePageLayout
                main={
                    <>
                        <ForgeDividedCard
                            title="Sites"
                            action={
                                <Button variant="primary" size="sm" asChild>
                                    <Link href={sitesIndex()}>New site</Link>
                                </Button>
                            }
                        >
                            {overview.sites.length === 0 ? (
                                <ForgeListRow className="text-[#64748b]">
                                    No sites yet.
                                </ForgeListRow>
                            ) : (
                                overview.sites.map((site) => (
                                    <ForgeListRow key={site.id}>
                                        <Link
                                            href={siteShow(site.id)}
                                            className="flex size-9 shrink-0 items-center justify-center rounded-md bg-[#f1f5f9] dark:bg-[#2e3032]"
                                        >
                                            <SiteFrameworkIcon
                                                type={site.type}
                                                size="md"
                                            />
                                        </Link>
                                        <div className="min-w-0 flex-1">
                                            <Link
                                                href={siteShow(site.id)}
                                                className="font-medium text-[#0f172a] hover:text-[#18B69B] dark:text-[#f8fafc]"
                                            >
                                                {site.name}
                                            </Link>
                                            <p className="truncate font-mono text-xs text-[#64748b]">
                                                {site.repository_connected
                                                    ? `${site.repository}:${site.repository_branch}`
                                                    : 'No repository connected'}
                                            </p>
                                        </div>
                                        <div className="hidden items-center gap-2 sm:flex">
                                            {site.php_version && (
                                                <ForgeRuntimeBadge
                                                    label={`PHP ${site.php_version}`}
                                                />
                                            )}
                                            <ForgeFrameworkBadge type={site.type} />
                                        </div>
                                        <span className="hidden text-xs text-[#64748b] lg:inline">
                                            Deployed{' '}
                                            {timeAgo(site.last_deployed_at)}
                                        </span>
                                        <RowMenu />
                                    </ForgeListRow>
                                ))
                            )}
                        </ForgeDividedCard>

                        <ForgeDividedCard title="Databases">
                            {overview.databases.length === 0 ? (
                                <ForgeListRow className="text-[#64748b]">
                                    No databases yet.
                                </ForgeListRow>
                            ) : (
                                overview.databases.map((database) => (
                                    <ForgeListRow key={database.id}>
                                        <div className="min-w-0 flex-1 font-mono text-sm text-[#0f172a] dark:text-[#f8fafc]">
                                            {database.name}
                                        </div>
                                        <ForgeStatusBadge label={database.status} />
                                        <RowMenu />
                                    </ForgeListRow>
                                ))
                            )}
                        </ForgeDividedCard>

                        <ForgeDividedCard title="Background Processes">
                            {overview.processes.length === 0 ? (
                                <ForgeListRow className="text-[#64748b]">
                                    No background processes.
                                </ForgeListRow>
                            ) : (
                                overview.processes.map((process) => (
                                    <ForgeListRow key={process.id}>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium text-[#0f172a] dark:text-[#f8fafc]">
                                                {process.name}
                                            </p>
                                            <p className="truncate font-mono text-xs text-[#64748b]">
                                                {process.command}
                                            </p>
                                        </div>
                                        <ForgeStatusBadge
                                            label={
                                                process.status === 'running'
                                                    ? 'Running'
                                                    : process.status
                                            }
                                            pulse={process.status === 'running'}
                                        />
                                        <RowMenu />
                                    </ForgeListRow>
                                ))
                            )}
                        </ForgeDividedCard>

                        <ForgeDividedCard title="Scheduled Jobs">
                            {overview.cronJobs.length === 0 ? (
                                <ForgeListRow className="text-[#64748b]">
                                    No scheduled jobs.
                                </ForgeListRow>
                            ) : (
                                overview.cronJobs.map((job) => (
                                    <ForgeListRow key={job.id}>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium text-[#0f172a] dark:text-[#f8fafc]">
                                                {job.name}
                                            </p>
                                            <p className="text-xs text-[#64748b]">
                                                {job.frequency}
                                            </p>
                                        </div>
                                        <ForgeStatusBadge
                                            label={job.enabled ? 'Installed' : 'Disabled'}
                                        />
                                        <RowMenu />
                                    </ForgeListRow>
                                ))
                            )}
                        </ForgeDividedCard>

                        <ForgeDividedCard title="Activity">
                            {overview.activity.length === 0 ? (
                                <ForgeListRow className="text-[#64748b]">
                                    No recent activity.
                                </ForgeListRow>
                            ) : (
                                overview.activity.map((entry) => (
                                    <ForgeListRow
                                        key={entry.id}
                                        className="items-start"
                                    >
                                        <div
                                            className={cn(
                                                'mt-0.5 size-2 shrink-0 rounded-full bg-[#18B69B]',
                                            )}
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium text-[#0f172a] dark:text-[#f8fafc]">
                                                {entry.label}
                                            </p>
                                            {entry.description && (
                                                <p className="truncate text-xs text-[#64748b]">
                                                    {entry.description}
                                                </p>
                                            )}
                                            <p className="mt-0.5 text-xs text-[#94a3b8]">
                                                {timeAgo(entry.created_at)} by{' '}
                                                {entry.user_name}
                                            </p>
                                        </div>
                                    </ForgeListRow>
                                ))
                            )}
                        </ForgeDividedCard>
                    </>
                }
                sidebar={
                    <>
                        <ForgeDetailsSection title="Details">
                            <ForgeDetailRow
                                label="Server ID"
                                value={String(server.id)}
                            />
                            <ForgeDetailRow
                                label="Site user"
                                value={server.site_user}
                                mono
                            />
                            <ForgeDetailRow
                                label="Hostname"
                                value={server.hostname}
                                mono
                            />
                            <ForgeDetailRow
                                label="Created"
                                value={formatDate(server.created_at)}
                            />
                        </ForgeDetailsSection>

                        <ForgeDetailsSection title="Networking">
                            <ForgeDetailRow
                                label="Public IP"
                                value={server.public_ip}
                                mono
                                copyable
                            />
                        </ForgeDetailsSection>
                    </>
                }
            />
        </>
    );
}

Dashboard.layout = {
    breadcrumbs: [{ title: 'Overview', href: dashboard() }],
};
