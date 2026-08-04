import { usePage } from '@inertiajs/react';
import type { PropsWithChildren } from 'react';
import { ForgeSiteChrome } from '@/components/forge/forge-site-header';
import {
    DeploymentStream,
    type DeploymentStreamPayload,
} from '@/components/sites/deployment-stream';
import { useSiteLiveUpdates } from '@/hooks/use-site-live-updates';

export type SiteSummary = {
    id: string;
    name: string;
    primary_domain?: string;
    repository?: string | null;
    repository_branch?: string;
    repository_connected?: boolean;
    deployment_status?: string;
    auto_deploy?: boolean;
    deploy_trigger?: string;
    effective_poll_interval_seconds?: number;
    ssl_status?: string;
    status?: string;
    type?: string;
    php_version?: string | null;
    app_env?: 'testing' | 'staging' | 'production' | null;
    [key: string]: unknown;
};

export default function SiteLayout({
    site,
    tab = 'overview',
    children,
}: PropsWithChildren<{ site?: SiteSummary; tab?: string }>) {
    const page = usePage<{ activeDeployment?: DeploymentStreamPayload | null }>();
    const activeDeployment = page.props.activeDeployment ?? null;

    useSiteLiveUpdates(site, tab);

    return (
        <>
            {site && <ForgeSiteChrome site={site} tab={tab} />}
            {site && activeDeployment && (
                <div className="mb-6">
                    <DeploymentStream
                        siteId={site.id}
                        deployment={activeDeployment}
                    />
                </div>
            )}
            {children}
        </>
    );
}
