import { Link, usePage } from '@inertiajs/react';
import { motion, useReducedMotion } from 'framer-motion';
import type { PropsWithChildren } from 'react';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { show } from '@/routes/sites';

export type SiteSummary = {
    id: string;
    name: string;
    [key: string]: unknown;
};

const siteTabs = [
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
        <div className="px-4 py-6">
            <Heading
                title={site?.name ?? 'Sites'}
                description={
                    site
                        ? `Manage domains, deployments, and configuration for ${site.name}`
                        : 'Select a site to view its configuration'
                }
            />

            <div className="flex flex-col gap-6">
                <nav
                    className="relative -mb-px flex gap-1 overflow-x-auto border-b"
                    aria-label="Site sections"
                >
                    {siteTabs.map((item) => {
                        const isActive = site !== undefined && tab === item.key;

                        return (
                            <Button
                                key={item.key}
                                size="sm"
                                variant="ghost"
                                disabled={!site}
                                asChild={Boolean(site)}
                                className={cn(
                                    'relative shrink-0 rounded-none border-b-2 border-transparent px-3 text-muted-foreground',
                                    isActive && 'text-foreground',
                                )}
                            >
                                {site ? (
                                    <Link
                                        href={show(site.id, {
                                            query: { tab: item.key },
                                        })}
                                        preserveScroll
                                    >
                                        {item.title}
                                        {isActive && !reduceMotion && (
                                            <motion.span
                                                layoutId="site-tab-indicator"
                                                className="absolute inset-x-0 -bottom-px h-0.5 bg-primary"
                                                transition={{
                                                    type: 'spring',
                                                    stiffness: 380,
                                                    damping: 32,
                                                }}
                                            />
                                        )}
                                        {isActive && reduceMotion && (
                                            <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" />
                                        )}
                                    </Link>
                                ) : (
                                    <span>{item.title}</span>
                                )}
                            </Button>
                        );
                    })}
                </nav>

                <motion.div
                    key={`${site?.id ?? 'none'}-${tab}-${url}`}
                    initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="flex-1"
                >
                    {children}
                </motion.div>
            </div>
        </div>
    );
}
