import { Link, usePage } from '@inertiajs/react';
import { motion, useReducedMotion } from 'framer-motion';
import { GitBranch } from 'lucide-react';
import type { PropsWithChildren } from 'react';
import { PageHeader } from '@/components/console/page-header';
import { DeployButton } from '@/components/sites/deploy-button';
import { StatusPill, toStatus } from '@/components/status-pill';
import { cn } from '@/lib/utils';
import { show } from '@/routes/sites';

export type SiteSummary = {
    id: string;
    name: string;
    repository?: string | null;
    repository_branch?: string;
    repository_connected?: boolean;
    deployment_status?: string;
    status?: string;
    type?: string;
    [key: string]: unknown;
};

const SITE_TABS = [
    { key: 'overview', title: 'Overview' },
    { key: 'domains', title: 'Domains' },
    { key: 'ssl', title: 'TLS' },
    { key: 'nginx', title: 'Nginx' },
    { key: 'deployments', title: 'Deploy' },
    { key: 'environment', title: 'Env' },
    { key: 'supervisor', title: 'Workers' },
    { key: 'cron', title: 'Cron' },
    { key: 'console', title: 'Console' },
    { key: 'isolation', title: 'Isolation' },
    { key: 'settings', title: 'Settings' },
] as const;

export default function SiteLayout({
    site,
    tab = 'overview',
    children,
}: PropsWithChildren<{ site?: SiteSummary; tab?: string }>) {
    const reduceMotion = useReducedMotion();
    const { url } = usePage();

    return (
        <div className="flex flex-col gap-6 px-6 py-6">
            <PageHeader
                eyebrow={`sites // ${site?.name ?? 'select'}`}
                title={site?.name ?? 'Sites'}
                description={
                    site ? (
                        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span>
                                {site.type} · runtime, TLS, deploy pipeline
                            </span>
                            {site.repository_connected && site.repository && (
                                <Link
                                    href={show.url(site.id, {
                                        query: { tab: 'settings' },
                                    })}
                                    className="inline-flex items-center gap-1.5 font-mono text-[13px] text-fg-link hover:underline"
                                >
                                    <GitBranch
                                        aria-hidden="true"
                                        strokeWidth={1.5}
                                        className="size-3.5"
                                    />
                                    {site.repository}
                                    {site.repository_branch
                                        ? `@${site.repository_branch}`
                                        : ''}
                                </Link>
                            )}
                        </span>
                    ) : (
                        'Select a site to manage its configuration.'
                    )
                }
                actions={
                    site ? (
                        <div className="flex flex-wrap items-center gap-2">
                            <StatusPill
                                status={toStatus(site.status ?? 'active')}
                                label={site.status ?? 'active'}
                                size="sm"
                            />
                            <StatusPill
                                status={toStatus(
                                    site.deployment_status ?? 'idle',
                                )}
                                label={site.deployment_status ?? 'idle'}
                                size="sm"
                            />
                            <DeployButton
                                siteId={site.id}
                                repository={site.repository ?? null}
                                deploymentStatus={site.deployment_status}
                            />
                        </div>
                    ) : undefined
                }
            />

            <nav
                className="relative -mb-px flex gap-0.5 overflow-x-auto border-b border-[var(--bc-border-default)]"
                aria-label="Site sections"
            >
                {SITE_TABS.map((item) => {
                    const isActive = site !== undefined && tab === item.key;

                    const classes = cn(
                        'relative shrink-0 px-3 py-2.5 text-[14px] leading-5 font-medium whitespace-nowrap',
                        'transition-colors duration-[--bc-duration-fast]',
                        isActive
                            ? 'text-fg-strong'
                            : 'text-fg-muted hover:text-fg',
                    );

                    if (!site) {
                        return (
                            <span
                                key={item.key}
                                className={cn(classes, 'opacity-50')}
                            >
                                {item.title}
                            </span>
                        );
                    }

                    return (
                        <Link
                            key={item.key}
                            href={show(site.id, { query: { tab: item.key } })}
                            preserveScroll
                            className={classes}
                        >
                            {item.title}
                            {isActive &&
                                (reduceMotion ? (
                                    <span className="absolute inset-x-0 -bottom-px h-0.5 bg-[var(--bc-bg-brand)]" />
                                ) : (
                                    <motion.span
                                        layoutId="site-tab-indicator"
                                        className="absolute inset-x-0 -bottom-px h-0.5 bg-[var(--bc-bg-brand)]"
                                        transition={{
                                            type: 'spring',
                                            stiffness: 380,
                                            damping: 32,
                                        }}
                                    />
                                ))}
                        </Link>
                    );
                })}
            </nav>

            <motion.div
                key={`${site?.id ?? 'none'}-${tab}-${url}`}
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                className="flex-1"
            >
                {children}
            </motion.div>
        </div>
    );
}
