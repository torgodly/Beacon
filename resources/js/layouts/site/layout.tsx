import { Link, usePage } from '@inertiajs/react';
import type { PropsWithChildren } from 'react';
import { ForgeSiteTabs } from '@/components/forge/forge-tabs';
import { ForgeContainer } from '@/components/forge/forge-container';
import { ForgeStatusBadge } from '@/components/forge/forge-badge';
import { DeployButton } from '@/components/sites/deploy-button';
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
    usePage();

    return (
        <>
            {site && (
                <div className="-mt-6 mb-6">
                    <ForgeSiteTabs siteId={site.id} tab={tab} tabs={SITE_TABS} />
                    <div className="border-b border-[#e2e8f0] bg-white dark:border-[#2e3032] dark:bg-[#1f2021]">
                        <ForgeContainer className="flex flex-wrap items-center justify-end gap-2 py-3">
                            <ForgeStatusBadge
                                label={site.status ?? 'active'}
                                pulse={(site.status ?? 'active') === 'active'}
                            />
                            <ForgeStatusBadge
                                label={site.deployment_status ?? 'idle'}
                            />
                            <DeployButton
                                siteId={site.id}
                                repository={site.repository ?? null}
                                deploymentStatus={site.deployment_status}
                                size="sm"
                            />
                            {site.repository_connected && site.repository && (
                                <Link
                                    href={show.url(site.id, {
                                        query: { tab: 'settings' },
                                    })}
                                    className="font-mono text-xs text-[#64748b] hover:text-[#18B69B]"
                                >
                                    {site.repository}@
                                    {site.repository_branch ?? 'main'}
                                </Link>
                            )}
                        </ForgeContainer>
                    </div>
                </div>
            )}

            {children}
        </>
    );
}
