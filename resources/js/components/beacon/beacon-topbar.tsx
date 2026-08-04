import { Menu, Search } from 'lucide-react';
import { useState } from 'react';
import { BeaconNavList } from '@/components/beacon/beacon-rail';
import { BeaconNavUser } from '@/components/beacon/beacon-nav-user';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import type { BreadcrumbItem } from '@/types';

export function BeaconTopbar({
    breadcrumbs = [],
}: {
    breadcrumbs?: BreadcrumbItem[];
}) {
    const [mobileOpen, setMobileOpen] = useState(false);

    const openCommandPalette = () => {
        document.dispatchEvent(
            new KeyboardEvent('keydown', {
                key: 'k',
                metaKey: true,
                bubbles: true,
            }),
        );
    };

    return (
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-[#E8EEF3]/80 bg-white/75 px-4 backdrop-blur-xl sm:px-6 dark:border-[#263647]/80 dark:bg-[#05131E]/75">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="md:hidden"
                        aria-label="Open navigation"
                    >
                        <Menu className="size-5" />
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[280px] p-0">
                    <SheetHeader className="border-b border-[#E8EEF3] px-4 py-4 dark:border-[#263647]">
                        <SheetTitle className="font-display text-left text-lg">
                            Beacon
                        </SheetTitle>
                    </SheetHeader>
                    <BeaconNavList onNavigate={() => setMobileOpen(false)} />
                    <div className="border-t border-[#E8EEF3] p-4 dark:border-[#263647]">
                        <BeaconNavUser expanded />
                    </div>
                </SheetContent>
            </Sheet>

            <div className="min-w-0 flex-1">
                <Breadcrumbs breadcrumbs={breadcrumbs} />
            </div>

            <Button
                variant="secondary"
                size="sm"
                className="hidden gap-2 sm:inline-flex"
                onClick={openCommandPalette}
            >
                <Search className="size-4" />
                <span className="text-[#5C7085]">Search</span>
                <kbd className="pointer-events-none hidden rounded-md border border-[#D2DCE5] bg-[#F5F8FA] px-1.5 py-0.5 font-mono text-[10px] text-[#8095A8] lg:inline dark:border-[#364554] dark:bg-[#1C2D3F]">
                    ⌘K
                </kbd>
            </Button>

            <Button
                variant="ghost"
                size="icon"
                className="sm:hidden"
                aria-label="Search"
                onClick={openCommandPalette}
            >
                <Search className="size-5" />
            </Button>
        </header>
    );
}
