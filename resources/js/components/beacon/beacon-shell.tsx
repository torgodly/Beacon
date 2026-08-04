import type { ReactNode } from 'react';
import { BeaconRail } from '@/components/beacon/beacon-rail';
import { BeaconTopbar } from '@/components/beacon/beacon-topbar';
import { CommandPalette } from '@/components/command-palette';
import type { BreadcrumbItem } from '@/types';

export function BeaconShell({
    children,
    breadcrumbs = [],
    commandPalette,
}: {
    children: ReactNode;
    breadcrumbs?: BreadcrumbItem[];
    commandPalette?: React.ComponentProps<typeof CommandPalette>['data'];
}) {
    return (
        <>
            {commandPalette ? <CommandPalette data={commandPalette} /> : null}

            <div className="flex min-h-svh w-full bg-[#F5F8FA] dark:bg-[#05131E]">
                <BeaconRail className="hidden md:flex" />

                <div className="flex min-w-0 flex-1 flex-col">
                    <BeaconTopbar breadcrumbs={breadcrumbs} />

                    <main className="beacon-canvas flex-1 overflow-x-hidden">
                        <div className="mx-auto w-full max-w-[1600px]">{children}</div>
                    </main>
                </div>
            </div>
        </>
    );
}
