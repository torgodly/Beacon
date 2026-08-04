import { Link, router } from '@inertiajs/react';
import { Check, ChevronRight, GitBranch, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { forge } from '@/components/forge/forge-tokens';
import { show } from '@/routes/sites';

export type ForgeDeploymentRow = {
    uuid: string;
    status: string;
    trigger: string;
    branch: string | null;
    commit_sha: string | null;
    commit_message: string | null;
    commit_author: string | null;
    created_at: string | null;
};

function timeAgo(iso: string | null): string {
    if (!iso) {
        return 'Unknown time';
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

    if (days < 7) {
        return `${days} day${days === 1 ? '' : 's'} ago`;
    }

    const weeks = Math.floor(days / 7);

    return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
}

function triggerLabel(trigger: string): string {
    return (
        {
            manual: 'Manual deploy',
            webhook: 'Push to deploy',
            poll: 'Poll',
            api: 'API',
            redeploy: 'Redeploy',
        }[trigger] ?? trigger
    );
}

function DeploymentStatusPip({ status }: { status: string }) {
    const failed = status === 'failed' || status === 'cancelled';
    const running = status === 'running' || status === 'queued';

    return (
        <div className="relative shrink-0">
            <div className="size-5 rounded-full border border-[#e2e8f0] bg-white p-0.5 shadow-sm dark:border-[#2e3032] dark:bg-[#1f2021]">
                <div
                    className={cn(
                        'flex size-full items-center justify-center rounded-full',
                        failed
                            ? 'bg-red-500'
                            : running
                              ? 'bg-amber-400'
                              : 'bg-[#18B69B]',
                    )}
                >
                    {failed ? (
                        <X className="size-2.5 text-white" strokeWidth={2.5} />
                    ) : running ? (
                        <span className="size-1.5 animate-pulse rounded-full bg-white" />
                    ) : (
                        <Check
                            className="size-2.5 text-white"
                            strokeWidth={2.5}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

export function ForgeDeploymentRowLink({
    siteId,
    deployment,
}: {
    siteId: string;
    deployment: ForgeDeploymentRow;
}) {
    const sha = deployment.commit_sha?.slice(0, 7) ?? '—';
    const branch = deployment.branch ?? 'main';

    return (
        <button
            type="button"
            onClick={() =>
                router.get(
                    show.url(siteId, {
                        query: {
                            tab: 'deployments',
                            deployment: deployment.uuid,
                        },
                    }),
                    { preserveScroll: true },
                )
            }
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18B69B]/40 focus-visible:ring-inset dark:hover:bg-[#151718]/60"
        >
            <DeploymentStatusPip status={deployment.status} />

            <span className="hidden w-16 shrink-0 font-mono text-xs tabular-nums text-[#0f172a] sm:inline dark:text-[#f8fafc]">
                {sha}
            </span>

            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                <GitBranch
                    className="size-4 shrink-0 text-[#94a3b8]"
                    strokeWidth={1.75}
                />
                <span className="truncate text-sm text-[#334155] dark:text-[#e2e8f0]">
                    {deployment.commit_message ??
                        `${deployment.trigger} deployment`}
                </span>
            </div>

            <div className="hidden min-w-fit shrink-0 text-right text-xs text-[#64748b] lg:block dark:text-[#94a3b8]">
                <span className="capitalize">{deployment.status}</span>
                {deployment.branch ? (
                    <>
                        {' '}
                        from{' '}
                        <code className="mx-0.5 rounded bg-[#f1f5f9] px-1 py-0.5 font-mono text-[11px] text-[#334155] dark:bg-[#2e3032] dark:text-[#e2e8f0]">
                            {branch}
                        </code>
                    </>
                ) : null}{' '}
                <span className="lowercase">{timeAgo(deployment.created_at)}</span>
                {' · '}
                <span className="font-medium text-[#0f172a] dark:text-[#f8fafc]">
                    {triggerLabel(deployment.trigger)}
                </span>
            </div>
        </button>
    );
}

export function ForgeDeploymentsSection({
    siteId,
    deployments,
    limit,
    linkToTab = true,
    title = 'Deployments',
    emptyMessage = 'No deployments yet. Connect a repository and press Deploy.',
}: {
    siteId: string;
    deployments: ForgeDeploymentRow[];
    limit?: number;
    linkToTab?: boolean;
    title?: string;
    emptyMessage?: string;
}) {
    const rows = limit ? deployments.slice(0, limit) : deployments;

    return (
        <section>
            <div className="flex items-center justify-between">
                {linkToTab ? (
                    <Link
                        href={show.url(siteId, { query: { tab: 'deployments' } })}
                        className="group inline-flex items-center gap-1 rounded-md p-1 text-base font-medium text-[#0f172a] hover:text-[#18B69B] dark:text-[#f8fafc]"
                    >
                        {title}
                        <ChevronRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                ) : (
                    <h2 className="text-base font-medium text-[#0f172a] dark:text-[#f8fafc]">
                        {title}
                    </h2>
                )}
            </div>

            <div className={cn(forge.card, 'mt-4 overflow-hidden')}>
                {rows.length === 0 ? (
                    <p className="px-4 py-8 text-center text-sm text-[#64748b]">
                        {emptyMessage}
                    </p>
                ) : (
                    <div className={forge.divide}>
                        {rows.map((deployment) => (
                            <ForgeDeploymentRowLink
                                key={deployment.uuid}
                                siteId={siteId}
                                deployment={deployment}
                            />
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
