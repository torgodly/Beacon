import { usePage } from '@inertiajs/react';
import type { PropsWithChildren } from 'react';
import { ForgeSiteChrome } from '@/components/forge/forge-site-header';

export type SiteSummary = {
    id: string;
    name: string;
    primary_domain?: string;
    repository?: string | null;
    repository_branch?: string;
    repository_connected?: boolean;
    deployment_status?: string;
    status?: string;
    type?: string;
    [key: string]: unknown;
};

export default function SiteLayout({
    site,
    tab = 'overview',
    children,
}: PropsWithChildren<{ site?: SiteSummary; tab?: string }>) {
    usePage();

    return (
        <>
            {site && <ForgeSiteChrome site={site} tab={tab} />}
            {children}
        </>
    );
}
