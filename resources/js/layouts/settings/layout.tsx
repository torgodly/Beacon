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
import { PageHeader } from '@/components/console/page-header';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { cn, toUrl } from '@/lib/utils';
import { edit as editAppearance } from '@/routes/appearance';
import { edit as editGitHub } from '@/routes/github';
import { edit } from '@/routes/profile';
import { edit as editSecurity } from '@/routes/security';
import { edit as editServer } from '@/routes/server';
import { edit as editUpdates } from '@/routes/updates';
import type { NavItem } from '@/types';

/**
 * Settings nav, grouped like the main sidebar: what belongs to you, and what
 * belongs to the machine.
 */
const GROUPS: Array<{ label: string; items: NavItem[] }> = [
    {
        label: 'account',
        items: [
            { title: 'Profile', href: edit(), icon: UserRound },
            { title: 'Security', href: editSecurity(), icon: ShieldCheck },
            { title: 'Appearance', href: editAppearance(), icon: Palette },
        ],
    },
    {
        label: 'server',
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
        <div className="flex flex-col gap-8 px-6 py-6">
            <PageHeader
                eyebrow="settings"
                title="Settings"
                description="Your account, and the configuration of this Beacon installation."
            />

            <div className="flex flex-col gap-8 lg:flex-row lg:gap-10">
                <aside className="w-full shrink-0 lg:w-56">
                    <nav
                        className="flex flex-col gap-5"
                        aria-label="Settings sections"
                    >
                        {GROUPS.map((group) => (
                            <div key={group.label}>
                                <p className="text-overline px-2 pb-1.5 font-mono text-fg-disabled">
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
                                                    'relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[14px] leading-5 font-medium',
                                                    'transition-colors duration-[--bc-duration-fast]',
                                                    active
                                                        ? 'bg-[var(--bc-bg-selected)] text-fg-strong'
                                                        : 'text-fg-muted hover:bg-[var(--bc-bg-hover)] hover:text-fg',
                                                )}
                                            >
                                                {/* 2px cyan marker, not colour alone. */}
                                                {active && (
                                                    <span
                                                        aria-hidden="true"
                                                        className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-[var(--bc-bg-brand)]"
                                                    />
                                                )}
                                                {item.icon && (
                                                    <item.icon
                                                        aria-hidden="true"
                                                        strokeWidth={1.5}
                                                        className="size-4 shrink-0"
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

                <section className="min-w-0 flex-1 space-y-8 lg:max-w-3xl">
                    {children}
                </section>
            </div>
        </div>
    );
}
