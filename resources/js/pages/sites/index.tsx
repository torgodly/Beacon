import { Head, Link } from '@inertiajs/react';
import { GitBranch, Globe } from 'lucide-react';
import { useMemo } from 'react';
import {
    ForgeDividedCard,
    ForgeListRow,
} from '@/components/forge/forge-divided-card';
import {
    ForgeDetailRow,
    ForgeDetailsSection,
    ForgePageLayout,
} from '@/components/forge/forge-details-sidebar';
import { ForgeStatusBadge } from '@/components/forge/forge-badge';
import {
    ForgeActionsPanel,
    ForgeEmptyState,
} from '@/components/forge/forge-empty-state';
import { CreateSiteDialog } from '@/components/sites/create-site-dialog';
import { SiteFrameworkIcon } from '@/components/sites/site-framework-icon';
import { SiteMetaBadges } from '@/components/sites/site-meta-badges';
import { index as sitesIndex, show } from '@/routes/sites';

type SiteRow = {
    id: string;
    name: string;
    type: string;
    status: string;
    ssl_status: string;
    deployment_status: string;
    repository: string | null;
    repository_branch: string;
    repository_connected: boolean;
    php_version: string | null;
    app_env: 'testing' | 'staging' | 'production' | null;
    database_driver: 'mysql' | 'sqlite' | null;
    redis_enabled: boolean;
    primary_domain: string;
};

type SiteTypeOption = {
    value: string;
    label: string;
    description: string;
    runtime: 'php' | 'node' | 'none';
    web_directory: string | null;
};

type RuntimeOption = { value: string; label: string; is_default: boolean };
type DatabaseOption = { id: number; name: string };

export default function SitesIndex({
    sites,
    siteTypes,
    phpVersions,
    nodeVersions,
    packageManager,
    github,
    databases,
}: {
    sites: SiteRow[];
    siteTypes: SiteTypeOption[];
    phpVersions: RuntimeOption[];
    nodeVersions: RuntimeOption[];
    packageManager: string;
    github: { connected: boolean };
    databases: DatabaseOption[];
}) {
    const stats = useMemo(() => sites.length, [sites]);

    const createSiteDialog = (
        <CreateSiteDialog
            siteTypes={siteTypes}
            phpVersions={phpVersions}
            nodeVersions={nodeVersions}
            packageManager={packageManager}
            github={github}
            databases={databases}
        />
    );

    return (
        <>
            <Head title="Sites" />

            {sites.length === 0 ? (
                <ForgePageLayout
                    main={
                        <ForgeEmptyState
                            icon={Globe}
                            title="No sites yet"
                            description="Create your first site and Beacon will provision the directory, the Nginx vhost and the runtime for you."
                        />
                    }
                    sidebar={
                        <>
                            <ForgeDetailsSection title="Sites">
                                <ForgeDetailRow label="Total" value="0" />
                                <ForgeDetailRow label="With Git" value="0" />
                                <ForgeDetailRow label="With TLS" value="0" />
                            </ForgeDetailsSection>
                            <ForgeActionsPanel>
                                {createSiteDialog}
                            </ForgeActionsPanel>
                        </>
                    }
                />
            ) : (
                <ForgePageLayout
                    main={
                        <ForgeDividedCard
                            title={`Sites (${stats})`}
                            action={createSiteDialog}
                        >
                            {sites.map((site) => (
                                <ForgeListRow key={site.id}>
                                    <Link
                                        href={show(site.name)}
                                        className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#f1f5f9] dark:bg-[#2e3032]"
                                    >
                                        <SiteFrameworkIcon
                                            type={site.type}
                                            size="md"
                                        />
                                    </Link>
                                    <Link
                                        href={show(site.name)}
                                        className="min-w-0 flex-1"
                                    >
                                        <p className="truncate font-medium text-[#0f172a] dark:text-[#f8fafc]">
                                            {site.primary_domain || site.name}
                                        </p>
                                        <p className="mt-0.5 flex items-center gap-1 truncate font-mono text-xs text-[#64748b]">
                                            {site.repository_connected &&
                                            site.repository ? (
                                                <>
                                                    <GitBranch className="size-3 shrink-0" />
                                                    {site.repository}:
                                                    {site.repository_branch}
                                                </>
                                            ) : (
                                                'No repository connected'
                                            )}
                                        </p>
                                    </Link>
                                    <SiteMetaBadges site={site} />
                                    <ForgeStatusBadge
                                        label={
                                            site.deployment_status === 'success'
                                                ? 'Deployed'
                                                : site.deployment_status
                                        }
                                        pulse={
                                            site.deployment_status ===
                                            'deploying'
                                        }
                                    />
                                </ForgeListRow>
                            ))}
                        </ForgeDividedCard>
                    }
                    sidebar={
                        <ForgeDetailsSection title="Sites">
                            <ForgeDetailRow
                                label="Total"
                                value={String(sites.length)}
                            />
                            <ForgeDetailRow
                                label="With Git"
                                value={String(
                                    sites.filter((s) => s.repository_connected)
                                        .length,
                                )}
                            />
                            <ForgeDetailRow
                                label="With TLS"
                                value={String(
                                    sites.filter(
                                        (s) =>
                                            s.ssl_status === 'active' ||
                                            s.ssl_status === 'issued',
                                    ).length,
                                )}
                            />
                        </ForgeDetailsSection>
                    }
                />
            )}
        </>
    );
}

SitesIndex.layout = {
    breadcrumbs: [{ title: 'Sites', href: sitesIndex() }],
};
