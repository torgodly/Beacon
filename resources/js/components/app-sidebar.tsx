import { Link, usePage } from '@inertiajs/react';
import {
    Activity,
    Boxes,
    Code2,
    Database,
    Globe,
    LayoutGrid,
    Settings as SettingsIcon,
    Wrench,
} from 'lucide-react';
import AppLogo from '@/components/app-logo';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { dashboard } from '@/routes';
import { index as activityIndex } from '@/routes/activity';
import { index as databasesIndex } from '@/routes/databases';
import { index as phpIndex } from '@/routes/php';
import { edit as editProfile } from '@/routes/profile';
import { index as runtimesIndex } from '@/routes/runtimes';
import { index as servicesIndex } from '@/routes/services';
import { index as sitesIndex } from '@/routes/sites';
import type { NavItem } from '@/types';

/**
 * Grouped navigation.
 *
 * The previous sidebar was a flat eight-item list, which gave "Activity" the
 * same visual weight as "Sites". Grouping separates what you operate from what
 * the server provides from what you inspect.
 */
const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
    {
        label: 'operate',
        items: [
            { title: 'Dashboard', href: dashboard(), icon: LayoutGrid },
            { title: 'Sites', href: sitesIndex(), icon: Globe },
            { title: 'Databases', href: databasesIndex(), icon: Database },
        ],
    },
    {
        label: 'server',
        items: [
            { title: 'PHP', href: phpIndex(), icon: Code2 },
            { title: 'Runtimes', href: runtimesIndex(), icon: Boxes },
            { title: 'Services', href: servicesIndex(), icon: Wrench },
        ],
    },
    {
        label: 'inspect',
        items: [
            { title: 'Activity', href: activityIndex(), icon: Activity },
            { title: 'Settings', href: editProfile(), icon: SettingsIcon },
        ],
    },
];

type BeaconShared = {
    health?: { healthy: boolean; issues: unknown[] };
};

export function AppSidebar() {
    const page = usePage<{ beacon?: BeaconShared }>();
    const health = page.props.beacon?.health;
    const currentPath = new URL(page.url, 'http://localhost').pathname;

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboard()} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent className="gap-0">
                {NAV_GROUPS.map((group) => (
                    <div key={group.label} className="px-2 py-2">
                        <p className="text-overline px-2 pb-1.5 font-mono text-fg-disabled group-data-[collapsible=icon]:hidden">
                            {group.label}
                        </p>

                        <SidebarMenu>
                            {group.items.map((item) => {
                                const href =
                                    typeof item.href === 'string'
                                        ? item.href
                                        : item.href.url;
                                const isActive =
                                    href === '/dashboard'
                                        ? currentPath === '/dashboard'
                                        : currentPath.startsWith(href);

                                return (
                                    <SidebarMenuItem key={item.title}>
                                        <SidebarMenuButton
                                            asChild
                                            isActive={isActive}
                                            tooltip={{ children: item.title }}
                                            className={cn(
                                                'relative',
                                                // The active marker is a 2px
                                                // cyan bar, not just a colour
                                                // swap — colour alone is
                                                // invisible to a low-vision user.
                                                isActive &&
                                                    'before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-[var(--bc-bg-brand)]',
                                            )}
                                        >
                                            <Link href={item.href} prefetch>
                                                {item.icon && (
                                                    <item.icon strokeWidth={1.5} />
                                                )}
                                                <span>{item.title}</span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                );
                            })}
                        </SidebarMenu>
                    </div>
                ))}
            </SidebarContent>

            <SidebarFooter>
                {health && (
                    <div className="mb-1 flex items-center gap-2 rounded-md border border-[var(--bc-border-subtle)] bg-[var(--bc-bg-subtle)] px-2.5 py-2 group-data-[collapsible=icon]:hidden">
                        <span
                            aria-hidden="true"
                            className={cn(
                                'size-1.5 shrink-0 rounded-full',
                                health.healthy
                                    ? 'bg-[var(--bc-bg-success)]'
                                    : 'bg-[var(--bc-bg-warning)]',
                            )}
                        />
                        <span className="text-caption truncate text-fg-muted">
                            {health.healthy
                                ? 'All systems nominal'
                                : `${health.issues.length} issue${health.issues.length === 1 ? '' : 's'}`}
                        </span>
                    </div>
                )}

                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
