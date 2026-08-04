import type { ReactNode } from 'react';
import { ForgeHeader } from '@/components/forge/forge-header';
import { ForgeTabs } from '@/components/forge/forge-tabs';
import { ForgeContainer } from '@/components/forge/forge-container';
import { CommandPalette } from '@/components/command-palette';
import { forge } from '@/components/forge/forge-tokens';
import type { BreadcrumbItem } from '@/types';

export function ForgeShell({
    children,
    breadcrumbs = [],
    commandPalette,
    siteTabs,
}: {
    children: ReactNode;
    breadcrumbs?: BreadcrumbItem[];
    commandPalette?: React.ComponentProps<typeof CommandPalette>['data'];
    siteTabs?: ReactNode;
}) {
    return (
        <>
            {commandPalette ? <CommandPalette data={commandPalette} /> : null}

            <div className={forge.canvas + ' flex min-h-svh flex-col'}>
                <ForgeHeader breadcrumbs={breadcrumbs} />
                <ForgeTabs />
                {siteTabs}
                <main className="flex-1 py-6">
                    <ForgeContainer>{children}</ForgeContainer>
                </main>
            </div>
        </>
    );
}
