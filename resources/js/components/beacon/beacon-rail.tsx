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
import AppLogoIcon from '@/components/app-logo-icon';
import { BeaconNavUser } from '@/components/beacon/beacon-nav-user';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
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

const NAV: NavItem[] = [
    { title: 'Dashboard', href: dashboard(), icon: LayoutGrid },
    { title: 'Sites', href: sitesIndex(), icon: Globe },
    { title: 'Databases', href: databasesIndex(), icon: Database },
    { title: 'PHP', href: phpIndex(), icon: Code2 },
    { title: 'Runtimes', href: runtimesIndex(), icon: Boxes },
    { title: 'Services', href: servicesIndex(), icon: Wrench },
    { title: 'Activity', href: activityIndex(), icon: Activity },
    { title: 'Settings', href: editProfile(), icon: SettingsIcon },
];

type BeaconShared = {
    health?: { healthy: boolean; issues: unknown[] };
};

export function BeaconRail({ className }: { className?: string }) {
    const page = usePage<{ beacon?: BeaconShared }>();
    const health = page.props.beacon?.health;
    const currentPath = new URL(page.url, 'http://localhost').pathname;

    return (
        <aside
            className={cn(
                'flex w-[72px] shrink-0 flex-col items-center border-r border-[#E8EEF3] bg-white py-4 dark:border-[#101F2E] dark:bg-[#05131E]',
                className,
            )}
        >
            <Link
                href={dashboard()}
                prefetch
                className="mb-6 flex size-11 items-center justify-center rounded-xl bg-[#06C8E0] shadow-[0_0_20px_rgba(6,200,224,0.45)] transition-transform hover:scale-105 active:scale-95"
                aria-label="Beacon home"
            >
                <AppLogoIcon className="size-6 fill-current text-[#05131E]" />
            </Link>

            <nav className="flex flex-1 flex-col items-center gap-1.5" aria-label="Main">
                {NAV.map((item) => {
                    const href =
                        typeof item.href === 'string' ? item.href : item.href.url;
                    const isActive =
                        href === '/dashboard'
                            ? currentPath === '/dashboard'
                            : currentPath.startsWith(href);

                    return (
                        <Tooltip key={item.title} delayDuration={0}>
                            <TooltipTrigger asChild>
                                <Link
                                    href={item.href}
                                    prefetch
                                    aria-current={isActive ? 'page' : undefined}
                                    className={cn(
                                        'relative flex size-11 items-center justify-center rounded-xl transition-all',
                                        isActive
                                            ? 'bg-[#ECFDFF] text-[#04A3BC] shadow-[inset_0_0_0_1px_rgba(6,200,224,0.35)] dark:bg-[#063543]/50 dark:text-[#22D0E8]'
                                            : 'text-[#8095A8] hover:bg-[#F5F8FA] hover:text-[#1C2D3F] dark:hover:bg-[#1C2D3F]/60 dark:hover:text-[#E8EEF3]',
                                    )}
                                >
                                    {isActive && (
                                        <span
                                            aria-hidden="true"
                                            className="absolute -left-px top-2 bottom-2 w-[3px] rounded-full bg-[#06C8E0]"
                                        />
                                    )}
                                    {item.icon && (
                                        <item.icon strokeWidth={1.75} className="size-5" />
                                    )}
                                </Link>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="font-medium">
                                {item.title}
                            </TooltipContent>
                        </Tooltip>
                    );
                })}
            </nav>

            {health && (
                <Tooltip delayDuration={0}>
                    <TooltipTrigger asChild>
                        <div
                            className="mb-3 flex size-9 items-center justify-center rounded-full border border-[#E8EEF3] bg-[#F5F8FA] dark:border-[#263647] dark:bg-[#1C2D3F]"
                            aria-label={
                                health.healthy
                                    ? 'All systems nominal'
                                    : `${health.issues.length} issues`
                            }
                        >
                            <span
                                className={cn(
                                    'size-2.5 rounded-full',
                                    health.healthy
                                        ? 'animate-pulse bg-[#21C55D]'
                                        : 'bg-[#F59E0B]',
                                )}
                            />
                        </div>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                        {health.healthy
                            ? 'All systems nominal'
                            : `${health.issues.length} issue${health.issues.length === 1 ? '' : 's'}`}
                    </TooltipContent>
                </Tooltip>
            )}

            <BeaconNavUser />
        </aside>
    );
}

/** Full-width nav for mobile sheet. */
export function BeaconNavList({ onNavigate }: { onNavigate?: () => void }) {
    const page = usePage();
    const currentPath = new URL(page.url, 'http://localhost').pathname;

    return (
        <nav className="flex flex-col gap-1 p-2">
            {NAV.map((item) => {
                const href =
                    typeof item.href === 'string' ? item.href : item.href.url;
                const isActive =
                    href === '/dashboard'
                        ? currentPath === '/dashboard'
                        : currentPath.startsWith(href);

                return (
                    <Link
                        key={item.title}
                        href={item.href}
                        prefetch
                        onClick={onNavigate}
                        className={cn(
                            'flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium',
                            isActive
                                ? 'bg-[#ECFDFF] text-[#04A3BC] dark:bg-[#063543]/50 dark:text-[#22D0E8]'
                                : 'text-[#5C7085] hover:bg-[#F5F8FA] dark:text-[#AEBECC] dark:hover:bg-[#1C2D3F]',
                        )}
                    >
                        {item.icon && <item.icon className="size-5" strokeWidth={1.75} />}
                        {item.title}
                    </Link>
                );
            })}
        </nav>
    );
}
