import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Surface, MetricTile } from '@/components/beacon/surface';
import { cn } from '@/lib/utils';

/** @deprecated Use Surface from @/components/beacon/surface — kept for call-site compat. */
export function Panel({
    eyebrow,
    title,
    description,
    icon,
    actions,
    footer,
    flush = false,
    className,
    children,
}: {
    eyebrow?: string;
    title?: ReactNode;
    description?: ReactNode;
    icon?: LucideIcon;
    actions?: ReactNode;
    footer?: ReactNode;
    flush?: boolean;
    className?: string;
    children?: ReactNode;
}) {
    const composedTitle =
        eyebrow && title ? (
            <>
                <span className="mb-1 block text-[11px] font-bold tracking-[0.16em] text-[#06C8E0] uppercase">
                    {eyebrow.replace(/\s*\/\/\s*/g, ' · ')}
                </span>
                {title}
            </>
        ) : (
            (title ?? (eyebrow ? eyebrow.replace(/\s*\/\/\s*/g, ' · ') : undefined))
        );

    return (
        <Surface
            title={composedTitle}
            description={description}
            icon={icon}
            actions={actions}
            footer={footer}
            flush={flush}
            accent
            className={className}
        >
            {children}
        </Surface>
    );
}

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
    return (
        <div
            className={cn(
                'grid gap-3 sm:grid-cols-2 lg:grid-cols-4',
                className,
            )}
        >
            {stats.map((stat) => (
                <MetricTile
                    key={stat.label}
                    label={stat.label}
                    value={stat.value}
                    hint={stat.hint}
                    tone={stat.tone ?? 'default'}
                />
            ))}
        </div>
    );
}

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
                'grid gap-x-8 gap-y-5',
                columns === 1 && 'grid-cols-1',
                columns === 2 && 'grid-cols-1 sm:grid-cols-2',
                columns === 3 && 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
                columns === 4 && 'grid-cols-2 lg:grid-cols-4',
                className,
            )}
        >
            {items.map((item) => (
                <div key={item.label} className="min-w-0">
                    <dt className="text-[11px] font-semibold tracking-[0.12em] text-[#8095A8] uppercase">
                        {item.label}
                    </dt>
                    <dd
                        className={cn(
                            'mt-1.5 min-w-0 text-[14px] leading-relaxed break-all text-[#1C2D3F] dark:text-[#E8EEF3]',
                            item.mono === false && 'font-sans',
                            (item.mono ?? true) && 'font-mono text-[13px]',
                        )}
                    >
                        {item.value}
                    </dd>
                </div>
            ))}
        </dl>
    );
}
