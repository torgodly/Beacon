import { Link, usePage } from '@inertiajs/react';
import { motion, useReducedMotion } from 'framer-motion';
import type { PropsWithChildren } from 'react';
import { PageHeader } from '@/components/console/page-header';
import { cn } from '@/lib/utils';
import { show } from '@/routes/sites';

export type SiteSummary = {
    id: string;
    name: string;
    [key: string]: unknown;
};

const SITE_TABS = [
    { key: 'overview', title: 'Overview' },
    { key: 'domains', title: 'Domains' },
    { key: 'ssl', title: 'SSL' },
    { key: 'nginx', title: 'Nginx' },
    { key: 'deployments', title: 'Deployments' },
    { key: 'environment', title: 'Environment' },
    { key: 'supervisor', title: 'Supervisor' },
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
                    site
                        ? 'Domains, deployments, runtime and configuration for this site.'
                        : 'Select a site to view its configuration.'
                }
            />

            <nav
                className="relative -mb-px flex gap-0.5 overflow-x-auto border-b border-[var(--bc-border-default)]"
                aria-label="Site sections"
            >
                {SITE_TABS.map((item) => {
                    const isActive = site !== undefined && tab === item.key;

                    const classes = cn(
                        'relative shrink-0 whitespace-nowrap px-3 py-2.5 text-[14px] leading-5 font-medium',
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
                            {/* A 2px cyan underline, so the current tab stays
                              * legible without relying on colour alone. */}
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
