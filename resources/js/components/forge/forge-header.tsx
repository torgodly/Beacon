import { Link, usePage } from '@inertiajs/react';
import {
    Bell,
    ChevronRight,
    HelpCircle,
    Search,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SiteFrameworkIcon } from '@/components/sites/site-framework-icon';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserMenuContent } from '@/components/user-menu-content';
import { useInitials } from '@/hooks/use-initials';
import { cn } from '@/lib/utils';
import { ForgeContainer } from '@/components/forge/forge-container';
import type { BreadcrumbItem } from '@/types';

type SharedServer = {
    id: number;
    hostname: string;
    public_ip: string;
};

type SiteContext = {
    id: string;
    name: string;
    type?: string;
};

export function ForgeHeader({
    breadcrumbs = [],
}: {
    breadcrumbs?: BreadcrumbItem[];
}) {
    const page = usePage<{
        auth: { user: { name: string; email: string; avatar?: string | null } | null };
        server?: SharedServer | null;
        site?: SiteContext;
    }>();
    const { auth, server, site } = page.props;
    const getInitials = useInitials();

    const openCommandPalette = () => {
        document.dispatchEvent(
            new KeyboardEvent('keydown', {
                key: 'k',
                metaKey: true,
                bubbles: true,
            }),
        );
    };

    const serverName = server?.hostname ?? 'Server';

    return (
        <header className="border-b border-[#e2e8f0] bg-white dark:border-[#2e3032] dark:bg-[#1f2021]">
            <ForgeContainer className="flex h-14 items-center justify-between gap-4">
                <nav
                    className="flex min-w-0 items-center gap-1.5 text-sm"
                    aria-label="Breadcrumb"
                >
                    <Link
                        href="/dashboard"
                        className="flex items-center gap-2 truncate font-medium text-[#0f172a] hover:text-[#18B69B] dark:text-[#f8fafc]"
                    >
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#18B69B]/15 text-[11px] font-semibold text-[#18B69B]">
                            {serverName.charAt(0).toUpperCase()}
                        </span>
                        <span className="hidden truncate sm:inline">
                            {serverName}
                        </span>
                    </Link>

                    {(site || breadcrumbs.length > 1) && (
                        <>
                            <ChevronRight className="size-4 shrink-0 text-[#94a3b8]" />
                            {site ? (
                                <span className="flex items-center gap-2 truncate font-medium text-[#0f172a] dark:text-[#f8fafc]">
                                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#f1f5f9] text-[11px] font-semibold text-[#475569] dark:bg-[#2e3032] dark:text-[#cbd5e1]">
                                        {site.name.charAt(0).toUpperCase()}
                                    </span>
                                    <span className="truncate">{site.name}</span>
                                    {site.type && (
                                        <span className="hidden sm:inline-flex">
                                            <SiteFrameworkIcon
                                                type={site.type}
                                                size="sm"
                                            />
                                        </span>
                                    )}
                                </span>
                            ) : (
                                breadcrumbs.slice(-1).map((crumb) => (
                                    <span
                                        key={crumb.title}
                                        className="truncate font-medium text-[#0f172a] dark:text-[#f8fafc]"
                                    >
                                        {crumb.title}
                                    </span>
                                ))
                            )}
                        </>
                    )}
                </nav>

                <div className="flex shrink-0 items-center gap-1">
                    <button
                        type="button"
                        onClick={openCommandPalette}
                        className="hidden items-center gap-2 rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-3 py-1.5 text-sm text-[#64748b] hover:border-[#cbd5e1] sm:flex dark:border-[#2e3032] dark:bg-[#151718] dark:text-[#94a3b8]"
                    >
                        <Search className="size-4" />
                        Search
                        <kbd className="rounded border border-[#e2e8f0] bg-white px-1.5 py-0.5 font-mono text-[10px] dark:border-[#2e3032] dark:bg-[#1f2021]">
                            ⌘K
                        </kbd>
                    </button>

                    <a
                        href="https://github.com/torgodly/beacon"
                        target="_blank"
                        rel="noreferrer"
                        className="hidden rounded-md p-2 text-[#64748b] hover:bg-[#f8fafc] hover:text-[#0f172a] sm:inline-flex dark:text-[#94a3b8] dark:hover:bg-[#151718] dark:hover:text-[#f8fafc]"
                        aria-label="Documentation"
                    >
                        <HelpCircle className="size-5" strokeWidth={1.75} />
                    </a>

                    <button
                        type="button"
                        className="rounded-md p-2 text-[#64748b] hover:bg-[#f8fafc] hover:text-[#0f172a] dark:text-[#94a3b8] dark:hover:bg-[#151718] dark:hover:text-[#f8fafc]"
                        aria-label="Notifications"
                    >
                        <Bell className="size-5" strokeWidth={1.75} />
                    </button>

                    {auth.user && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    className={cn(
                                        'ml-1 rounded-full ring-offset-white focus-visible:ring-2 focus-visible:ring-[#18B69B] focus-visible:outline-none dark:ring-offset-[#151718]',
                                    )}
                                >
                                    <Avatar className="size-8">
                                        <AvatarImage
                                            src={auth.user.avatar ?? undefined}
                                            alt={auth.user.name}
                                        />
                                        <AvatarFallback className="bg-[#18B69B]/15 text-xs font-semibold text-[#18B69B]">
                                            {getInitials(auth.user.name)}
                                        </AvatarFallback>
                                    </Avatar>
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-56">
                                <UserMenuContent user={auth.user} />
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            </ForgeContainer>
        </header>
    );
}
