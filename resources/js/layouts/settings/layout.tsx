import { Link } from '@inertiajs/react';
import {
    Github,
    Palette,
    RefreshCw,
    Server,
    ShieldCheck,
    UserRound,
} from 'lucide-react';
import type { PropsWithChildren } from 'react';
import { forge } from '@/components/forge/forge-tokens';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { cn, toUrl } from '@/lib/utils';
import { edit as editAppearance } from '@/routes/appearance';
import { edit as editGitHub } from '@/routes/github';
import { edit } from '@/routes/profile';
import { edit as editSecurity } from '@/routes/security';
import { edit as editServer } from '@/routes/server';
import { edit as editUpdates } from '@/routes/updates';
import type { NavItem } from '@/types';

const GROUPS: Array<{ label: string; items: NavItem[] }> = [
    {
        label: 'Account',
        items: [
            { title: 'Profile', href: edit(), icon: UserRound },
            { title: 'Security', href: editSecurity(), icon: ShieldCheck },
            { title: 'Appearance', href: editAppearance(), icon: Palette },
        ],
    },
    {
        label: 'Server',
        items: [
            { title: 'GitHub', href: editGitHub(), icon: Github },
            { title: 'Server', href: editServer(), icon: Server },
            { title: 'Panel updates', href: editUpdates(), icon: RefreshCw },
        ],
    },
];

export default function SettingsLayout({ children }: PropsWithChildren) {
    const { isCurrentOrParentUrl } = useCurrentUrl();

    return (
        <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
            <aside className={cn(forge.card, 'h-fit overflow-hidden')}>
                <header className="border-b border-[#e2e8f0] px-4 py-3 dark:border-[#2e3032]">
                    <h2 className="text-sm font-semibold text-[#0f172a] dark:text-[#f8fafc]">
                        Settings
                    </h2>
                </header>
                <nav className="p-2" aria-label="Settings">
                    {GROUPS.map((group) => (
                        <div key={group.label} className="py-2">
                            <p className="px-2 pb-1 text-[11px] font-semibold tracking-wide text-[#64748b] uppercase">
                                {group.label}
                            </p>
                            <div className="flex flex-col gap-0.5">
                                {group.items.map((item, index) => {
                                    const active = isCurrentOrParentUrl(
                                        item.href,
                                    );

                                    return (
                                        <Link
                                            key={`${toUrl(item.href)}-${index}`}
                                            href={item.href}
                                            className={cn(
                                                'flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium',
                                                active
                                                    ? 'bg-[#f8fafc] text-[#0f172a] dark:bg-[#151718] dark:text-[#f8fafc]'
                                                    : 'text-[#64748b] hover:bg-[#f8fafc] hover:text-[#0f172a] dark:hover:bg-[#151718] dark:hover:text-[#f8fafc]',
                                            )}
                                        >
                                            {item.icon && (
                                                <item.icon
                                                    className="size-4"
                                                    strokeWidth={1.75}
                                                />
                                            )}
                                            {item.title}
                                        </Link>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </nav>
            </aside>

            <div className="min-w-0 space-y-6">{children}</div>
        </div>
    );
}
