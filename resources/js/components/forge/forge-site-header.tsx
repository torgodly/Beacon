import { Link } from '@inertiajs/react';
import { ExternalLink } from 'lucide-react';
import { ForgeContainer } from '@/components/forge/forge-container';
import { ForgeSiteTabs } from '@/components/forge/forge-tabs';
import { DeployButton } from '@/components/sites/deploy-button';
import { Button } from '@/components/ui/button';
import { show } from '@/routes/sites';

type SiteChromeSite = {
    id: string;
    name: string;
    primary_domain?: string;
    repository?: string | null;
    repository_branch?: string;
    repository_connected?: boolean;
    deployment_status?: string;
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

export function ForgeSiteChrome({
    site,
    tab,
}: {
    site: SiteChromeSite;
    tab: string;
}) {
    const visitDomain = site.primary_domain || site.name;
    const visitUrl = `https://${visitDomain}`;

    return (
        <div className="-mt-6 mb-8">
            <div className="border-b border-[#e2e8f0] bg-white dark:border-[#2e3032] dark:bg-[#1f2021]">
                <ForgeContainer className="py-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#18B69B]/10 text-sm font-semibold text-[#18B69B] ring-1 ring-[#18B69B]/20">
                                {site.name.charAt(0).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                                <h1 className="truncate text-base font-semibold text-[#0f172a] dark:text-[#f8fafc]">
                                    {site.name}
                                </h1>
                                {site.repository_connected && site.repository ? (
                                    <Link
                                        href={show.url(site.id, {
                                            query: { tab: 'settings' },
                                        })}
                                        className="mt-0.5 block truncate font-mono text-xs text-[#64748b] hover:text-[#18B69B]"
                                    >
                                        {site.repository}@
                                        {site.repository_branch ?? 'main'}
                                    </Link>
                                ) : (
                                    <p className="mt-0.5 text-xs text-[#64748b]">
                                        No repository connected
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Button variant="secondary" size="sm" asChild>
                                <a
                                    href={visitUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    <ExternalLink className="size-3.5" />
                                    Visit
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
                </ForgeContainer>
            </div>

            <ForgeSiteTabs siteId={site.id} tab={tab} tabs={SITE_TABS} />
        </div>
    );
}

export { SITE_TABS };
