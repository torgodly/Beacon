import { Link } from '@inertiajs/react';
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
import { NavMain } from '@/components/nav-main';
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
import { dashboard } from '@/routes';
import { index as activityIndex } from '@/routes/activity';
import { index as databasesIndex } from '@/routes/databases';
import { index as phpIndex } from '@/routes/php';
import { edit as editProfile } from '@/routes/profile';
import { index as runtimesIndex } from '@/routes/runtimes';
import { index as servicesIndex } from '@/routes/services';
import { index as sitesIndex } from '@/routes/sites';
import type { NavItem } from '@/types';

const mainNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        href: dashboard(),
        icon: LayoutGrid,
    },
    {
        title: 'Sites',
        href: sitesIndex(),
        icon: Globe,
    },
    {
        title: 'Databases',
        href: databasesIndex(),
        icon: Database,
    },
    {
        title: 'PHP',
        href: phpIndex(),
        icon: Code2,
    },
    {
        title: 'Runtimes',
        href: runtimesIndex(),
        icon: Boxes,
    },
    {
        title: 'Services',
        href: servicesIndex(),
        icon: Wrench,
    },
    {
        title: 'Activity',
        href: activityIndex(),
        icon: Activity,
    },
    {
        title: 'Settings',
        href: editProfile(),
        icon: SettingsIcon,
    },
];

export function AppSidebar() {
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

            <SidebarContent>
                <NavMain items={mainNavItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
