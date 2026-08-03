import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Beacon's operator-console surface.
 *
 * A Panel is elevation-1 (surface + 1px border) with a mono uppercase eyebrow
 * instead of a generic card title. The eyebrow is the design system's
 * `overline` role — 11/16/600 at 0.06em — which is what gives the interface
 * its instrument-panel character rather than a generic dashboard look.
 */
export function Panel({
    eyebrow,
    title,
    description,
    icon: Icon,
    actions,
    footer,
    flush = false,
    className,
    children,
}: {
    /** Mono uppercase kicker, e.g. "infrastructure" or "php // extensions". */
    eyebrow?: string;
    title?: ReactNode;
    description?: ReactNode;
    icon?: LucideIcon;
    actions?: ReactNode;
    footer?: ReactNode;
    /** Removes body padding — use when the body is a full-bleed table. */
    flush?: boolean;
    className?: string;
    children?: ReactNode;
}) {
    const hasHeader = Boolean(eyebrow || title || description || actions);

    return (
        <section
            className={cn(
                'flex flex-col overflow-hidden rounded-lg bg-surface',
                'border border-[var(--bc-border-default)]',
                className,
            )}
        >
            {hasHeader && (
                <header
                    className={cn(
                        'flex items-start gap-4 px-6 py-4',
                        children != null &&
                            'border-b border-[var(--bc-border-subtle)]',
                    )}
                >
                    {Icon && (
                        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-[var(--bc-bg-subtle)] text-fg-subtle">
                            <Icon aria-hidden="true" strokeWidth={1.5} className="size-4" />
                        </span>
                    )}

                    <div className="min-w-0 flex-1">
                        {eyebrow && (
                            <p className="text-overline font-mono text-fg-subtle">
                                {eyebrow}
                            </p>
                        )}
                        {title && (
                            <h2 className="truncate text-[16px] leading-6 font-semibold text-fg-strong">
                                {title}
                            </h2>
                        )}
                        {description && (
                            <p className="mt-0.5 text-[13px] leading-5 text-fg-muted">
                                {description}
                            </p>
                        )}
                    </div>

                    {actions && (
                        <div className="flex shrink-0 items-center gap-3">
                            {actions}
                        </div>
                    )}
                </header>
            )}

            {children != null && (
                <div className={cn('min-w-0 flex-1', !flush && 'px-6 py-5')}>
                    {children}
                </div>
            )}

            {footer && (
                <footer className="border-t border-[var(--bc-border-subtle)] bg-[var(--bc-bg-surface-sunken)] px-6 py-3">
                    {footer}
                </footer>
            )}
        </section>
    );
}

/**
 * A row of counters — the "TOTAL 3 · ONLINE 2 · DRIFT 0" pattern.
 *
 * Metric values never count up on change: during an incident an animated
 * number means the figure on screen is wrong for the length of the tween.
 */
export function StatCluster({
    stats,
    className,
}: {
    stats: Array<{
        label: string;
        value: ReactNode;
        tone?: 'default' | 'success' | 'warning' | 'danger' | 'brand';
        hint?: string;
    }>;
    className?: string;
}) {
    const tones: Record<string, string> = {
        default: 'text-fg-strong',
        success: 'text-fg-success',
        warning: 'text-fg-warning',
        danger: 'text-fg-danger',
        brand: 'text-fg-brand',
    };

    return (
        <dl
            className={cn(
                'grid divide-x divide-[var(--bc-border-subtle)]',
                className,
            )}
            style={{
                gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))`,
            }}
        >
            {stats.map((stat) => (
                <div key={stat.label} className="px-5 first:pl-0 last:pr-0">
                    <dt className="text-overline font-mono text-fg-subtle">
                        {stat.label}
                    </dt>
                    <dd
                        className={cn(
                            'text-metric-md mt-1 tabular-nums',
                            tones[stat.tone ?? 'default'],
                        )}
                    >
                        {stat.value}
                    </dd>
                    {stat.hint && (
                        <p className="text-caption mt-0.5 text-fg-subtle">
                            {stat.hint}
                        </p>
                    )}
                </div>
            ))}
        </dl>
    );
}

/**
 * Label/value pairs for spec sheets — PHP version, socket path, doc root.
 * Values default to mono because almost all of them are identifiers, paths,
 * versions or numbers, which the system requires to be mono.
 */
export function SpecList({
    items,
    columns = 2,
    className,
}: {
    items: Array<{ label: string; value: ReactNode; mono?: boolean }>;
    columns?: 1 | 2 | 3 | 4;
    className?: string;
}) {
    return (
        <dl
            className={cn(
                'grid gap-x-6 gap-y-4',
                columns === 1 && 'grid-cols-1',
                columns === 2 && 'grid-cols-1 sm:grid-cols-2',
                columns === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
                columns === 4 && 'grid-cols-2 lg:grid-cols-4',
                className,
            )}
        >
            {items.map((item) => (
                <div key={item.label} className="min-w-0">
                    <dt className="text-overline font-mono text-fg-subtle">
                        {item.label}
                    </dt>
                    <dd
                        className={cn(
                            'mt-1 truncate text-[14px] leading-5 text-fg',
                            (item.mono ?? true) && 'font-mono tabular-nums',
                        )}
                    >
                        {item.value}
                    </dd>
                </div>
            ))}
        </dl>
    );
}
