import { usePage } from '@inertiajs/react';
import { AppContent } from '@/components/app-content';
import { AppShell } from '@/components/app-shell';
import { AppSidebar } from '@/components/app-sidebar';
import { AppSidebarHeader } from '@/components/app-sidebar-header';
import { CommandPalette } from '@/components/command-palette';
import type { AppLayoutProps } from '@/types';

export default function AppSidebarLayout({
    children,
    breadcrumbs = [],
}: AppLayoutProps) {
    const { auth, commandPalette } = usePage().props;

    return (
        <>
            {auth.user && commandPalette ? (
                <CommandPalette data={commandPalette} />
            ) : null}
            <AppShell variant="sidebar">
                <AppSidebar />
                <AppContent variant="sidebar" className="overflow-x-hidden">
                    <AppSidebarHeader breadcrumbs={breadcrumbs} />
                    {children}
                </AppContent>
            </AppShell>
        </>
    );
}
