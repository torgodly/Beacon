import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The standard page masthead.
 *
 * `eyebrow` renders as `beacon // sites`, which is what anchors every screen
 * to the same operator-console language instead of each page inventing its
 * own heading treatment.
 */
export function PageHeader({
    eyebrow,
    title,
    description,
    actions,
    className,
}: {
    eyebrow: string;
    title: string;
    description?: ReactNode;
    actions?: ReactNode;
    className?: string;
}) {
    return (
        <header
            className={cn(
                'flex flex-wrap items-end justify-between gap-4',
                className,
            )}
        >
            <div className="min-w-0">
                <p className="text-overline font-mono text-fg-subtle">
                    beacon <span className="text-fg-disabled">//</span> {eyebrow}
                </p>
                <h1 className="mt-1 truncate text-[30px] leading-[38px] font-bold tracking-[-0.01em] text-fg-strong">
                    {title}
                </h1>
                {description && (
                    <p className="mt-1 max-w-prose text-[14px] leading-[22px] text-fg-muted">
                        {description}
                    </p>
                )}
            </div>

            {actions && (
                <div className="flex shrink-0 items-center gap-3">{actions}</div>
            )}
        </header>
    );
}

/**
 * Empty state.
 *
 * The system forbids characters, mascots and decorative illustration, so this
 * is a plain framed icon plus a heading that carries the meaning and one
 * concrete next action.
 */
export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
    className,
}: {
    icon: LucideIcon;
    title: string;
    description?: string;
    action?: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[var(--bc-border-strong)] px-6 py-14 text-center',
                className,
            )}
        >
            <span className="flex size-11 items-center justify-center rounded-md border border-[var(--bc-border-default)] bg-[var(--bc-bg-subtle)] text-fg-subtle">
                <Icon aria-hidden="true" strokeWidth={1.5} className="size-5" />
            </span>

            <div className="space-y-1">
                <h3 className="text-[18px] leading-[26px] font-semibold text-fg-strong">
                    {title}
                </h3>
                {description && (
                    <p className="mx-auto max-w-sm text-[14px] leading-[22px] text-fg-muted">
                        {description}
                    </p>
                )}
            </div>

            {action && <div className="mt-1">{action}</div>}
        </div>
    );
}
