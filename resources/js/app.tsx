import { createInertiaApp } from '@inertiajs/react';
import { OperationDock } from '@/components/operations/operation-dock';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { initializeTheme } from '@/hooks/use-appearance';
import { OperationsProvider } from '@/hooks/use-operations';
import AppLayout from '@/layouts/app-layout';
import AuthLayout from '@/layouts/auth-layout';
import SettingsLayout from '@/layouts/settings/layout';
import SiteLayout from '@/layouts/site/layout';

const appName = import.meta.env.VITE_APP_NAME || 'Beacon';

createInertiaApp({
    title: (title) => (title ? `${title} - ${appName}` : appName),
    layout: (name) => {
        switch (true) {
            case name === 'welcome':
                return null;
            case name.startsWith('auth/'):
                return AuthLayout;
            case name.startsWith('settings/'):
                return [AppLayout, SettingsLayout];
            case name.startsWith('sites/'):
                return [AppLayout, SiteLayout];
            default:
                return AppLayout;
        }
    },
    strictMode: true,
    withApp(app) {
        return (
            <TooltipProvider delayDuration={0}>
                {/* The operations dock sits above the page tree so a running
                 * apt install keeps streaming while the operator navigates. */}
                <OperationsProvider>
                    {app}
                    <OperationDock />
                </OperationsProvider>
                <Toaster />
            </TooltipProvider>
        );
    },
    progress: {
        // cyan-500 — the beam.
        color: '#06C8E0',
    },
});

initializeTheme();
