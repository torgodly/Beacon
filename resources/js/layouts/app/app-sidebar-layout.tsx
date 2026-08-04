import { usePage } from '@inertiajs/react';
import { ForgeShell } from '@/components/forge/forge-shell';
import type { AppLayoutProps } from '@/types';

export default function AppSidebarLayout({
    children,
    breadcrumbs = [],
}: AppLayoutProps) {
    const { auth, commandPalette } = usePage().props;

    return (
        <ForgeShell
            breadcrumbs={breadcrumbs}
            commandPalette={auth.user && commandPalette ? commandPalette : undefined}
        >
            {children}
        </ForgeShell>
    );
}
