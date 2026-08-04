import { Link, usePage } from '@inertiajs/react';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import { index as databasesIndex } from '@/routes/databases';
import { index as phpIndex } from '@/routes/php';
import { edit as editProfile } from '@/routes/profile';
import { index as servicesIndex } from '@/routes/services';
import { index as sitesIndex } from '@/routes/sites';
import { ForgeContainer } from '@/components/forge/forge-container';
import { forge } from '@/components/forge/forge-tokens';

const TABS = [
    {
        label: 'Overview',
        href: dashboard(),
        isActive: (path: string) => path === '/dashboard',
    },
    {
        label: 'Sites',
        href: sitesIndex(),
        isActive: (path: string) => path.startsWith('/sites'),
    },
    {
        label: 'Storage',
        href: databasesIndex(),
        isActive: (path: string) => path.startsWith('/databases'),
    },
    {
        label: 'Processes',
        href: servicesIndex(),
        isActive: (path: string) =>
            path.startsWith('/services') || path.startsWith('/activity'),
    },
    {
        label: 'Runtime',
        href: phpIndex(),
        isActive: (path: string) =>
            path.startsWith('/php') || path.startsWith('/runtimes'),
    },
    {
        label: 'Settings',
        href: editProfile(),
        isActive: (path: string) => path.startsWith('/settings'),
    },
] as const;

export function ForgeTabs() {
    const page = usePage();
    const path = new URL(page.url, 'http://localhost').pathname;

    return (
        <nav
            className="border-b border-[#e2e8f0] bg-white dark:border-[#2e3032] dark:bg-[#1f2021]"
            aria-label="Server sections"
        >
            <ForgeContainer>
                <div className="-mb-px flex gap-6 overflow-x-auto">
                    {TABS.map((tab) => {
                        const active = tab.isActive(path);
                        const href =
                            typeof tab.href === 'string'
                                ? tab.href
                                : tab.href.url;

                        return (
                            <Link
                                key={tab.label}
                                href={href}
                                prefetch
                                className={cn(
                                    'shrink-0 py-3 text-sm font-medium transition-colors',
                                    active ? forge.tabActive : forge.tabInactive,
                                )}
                            >
                                {tab.label}
                            </Link>
                        );
                    })}
                </div>
            </ForgeContainer>
        </nav>
    );
}

/** Site-level sub navigation (2px bottom border). */
export function ForgeSiteTabs({
    siteId,
    tab,
    tabs,
}: {
    siteId: string;
    tab: string;
    tabs: ReadonlyArray<{ key: string; title: string }>;
}) {
    return (
        <nav
            className="border-b border-[#e2e8f0] bg-white dark:border-[#2e3032] dark:bg-[#1f2021]"
            aria-label="Site sections"
        >
            <ForgeContainer>
                <div className="-mb-px flex gap-5 overflow-x-auto">
                    {tabs.map((item) => {
                        const active = tab === item.key;

                        return (
                            <Link
                                key={item.key}
                                href={`/sites/${siteId}?tab=${item.key}`}
                                preserveScroll
                                className={cn(
                                    'shrink-0 py-3 text-sm font-medium transition-colors',
                                    active ? forge.tabActive : forge.tabInactive,
                                )}
                            >
                                {item.title}
                            </Link>
                        );
                    })}
                </div>
            </ForgeContainer>
        </nav>
    );
}
