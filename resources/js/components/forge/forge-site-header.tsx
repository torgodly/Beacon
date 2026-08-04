import { Link } from '@inertiajs/react';
import { ExternalLink, ShieldAlert } from 'lucide-react';
import { ForgeContainer } from '@/components/forge/forge-container';
import { ForgeFrameworkBadge } from '@/components/forge/forge-badge';
import { DeployButton } from '@/components/sites/deploy-button';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { show } from '@/routes/sites';

type SiteChromeSite = {
    id: string;
    name: string;
    primary_domain?: string;
    repository?: string | null;
    repository_branch?: string;
    repository_connected?: boolean;
    deployment_status?: string;
    ssl_status?: string;
    type?: string;
};

const SITE_TABS = [
    { key: 'overview', title: 'Overview' },
    { key: 'domains', title: 'Domains' },
    { key: 'ssl', title: 'TLS' },
    { key: 'nginx', title: 'Nginx' },
    { key: 'deployments', title: 'Deployments' },
    { key: 'environment', title: 'Env' },
    { key: 'supervisor', title: 'Workers' },
    { key: 'cron', title: 'Cron' },
    { key: 'console', title: 'Console' },
    { key: 'isolation', title: 'Isolation' },
    { key: 'settings', title: 'Settings' },
] as const;

const tabActive =
    'border-b-2 border-[#18B69B] text-[#0f172a] dark:text-[#f8fafc]';
const tabInactive =
    'border-b-2 border-transparent text-[#64748b] hover:text-[#334155] dark:text-[#94a3b8] dark:hover:text-[#e2e8f0]';

export function ForgeSiteChrome({
    site,
    tab,
}: {
    site: SiteChromeSite;
    tab: string;
}) {
    const visitDomain = site.primary_domain || site.name;
    const tlsIssued = site.ssl_status === 'issued';
    const visitUrl = `${tlsIssued ? 'https' : 'http'}://${visitDomain}`;

    return (
        <div className="mb-6 border-b border-[#e2e8f0] bg-white dark:border-[#2e3032] dark:bg-[#1f2021]">
            <ForgeContainer>
                <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        {site.type && (
                            <ForgeFrameworkBadge type={site.type} />
                        )}
                        {!tlsIssued && (
                            <Link
                                href={show.url(site.id, { query: { tab: 'ssl' } })}
                                className="inline-flex items-center gap-1 rounded-md border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 hover:border-amber-500/40 dark:text-amber-400"
                            >
                                <ShieldAlert className="size-3" />
                                TLS not configured
                            </Link>
                        )}
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <Button variant="secondary" size="sm" asChild>
                            <a
                                href={visitUrl}
                                target="_blank"
                                rel="noreferrer"
                            >
                                <ExternalLink className="size-3.5" />
                                Visit{tlsIssued ? '' : ' (HTTP)'}
                            </a>
                        </Button>
                        <DeployButton
                            siteId={site.id}
                            repository={site.repository ?? null}
                            deploymentStatus={site.deployment_status}
                            size="sm"
                        />
                    </div>
                </div>

                <nav
                    className="-mb-px flex gap-5 overflow-x-auto"
                    aria-label="Site sections"
                >
                    {SITE_TABS.map((item) => {
                        const active = tab === item.key;

                        return (
                            <Link
                                key={item.key}
                                href={show.url(site.id, {
                                    query: { tab: item.key },
                                })}
                                preserveScroll
                                className={cn(
                                    'shrink-0 py-3 text-sm font-medium transition-colors',
                                    active ? tabActive : tabInactive,
                                )}
                            >
                                {item.title}
                            </Link>
                        );
                    })}
                </nav>
            </ForgeContainer>
        </div>
    );
}

export { SITE_TABS };
