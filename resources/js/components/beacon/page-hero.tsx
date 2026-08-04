import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Beacon v2 page hero — large display type, gradient mesh, no mono eyebrows.
 */
export function PageHero({
    kicker,
    title,
    description,
    actions,
    className,
}: {
    kicker?: string;
    title: string;
    description?: ReactNode;
    actions?: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'relative overflow-hidden rounded-2xl border border-[#E8EEF3]/90 px-6 py-8 sm:px-8',
                'bg-gradient-to-br from-white via-white to-[#ECFDFF]/40',
                'shadow-[0_12px_40px_rgba(6,200,224,0.08)]',
                'dark:border-[#263647] dark:from-[#1C2D3F] dark:via-[#1C2D3F] dark:to-[#063543]/30',
                'dark:shadow-[0_12px_48px_rgba(0,0,0,0.4)]',
                className,
            )}
        >
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -top-20 -right-20 size-64 rounded-full bg-[#06C8E0]/10 blur-3xl dark:bg-[#06C8E0]/5"
            />
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-16 -left-16 size-48 rounded-full bg-[#8B5CF6]/8 blur-3xl"
            />

            <div className="relative flex flex-wrap items-end justify-between gap-6">
                <div className="min-w-0 max-w-3xl">
                    {kicker && (
                        <p className="text-[11px] font-bold tracking-[0.2em] text-[#06C8E0] uppercase">
                            {kicker}
                        </p>
                    )}
                    <h1 className="font-display mt-2 text-3xl font-bold tracking-tight text-[#05131E] sm:text-4xl dark:text-[#E8EEF3]">
                        {title}
                    </h1>
                    {description && (
                        <p className="mt-3 text-[15px] leading-relaxed text-[#5C7085] dark:text-[#AEBECC]">
                            {description}
                        </p>
                    )}
                </div>
                {actions && (
                    <div className="flex shrink-0 flex-wrap items-center gap-3">
                        {actions}
                    </div>
                )}
            </div>
        </div>
    );
}

export function EmptyHero({
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
                'flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-[#D2DCE5] bg-white/50 px-8 py-16 text-center dark:border-[#364554] dark:bg-[#1C2D3F]/30',
                className,
            )}
        >
            <span className="flex size-14 items-center justify-center rounded-2xl bg-[#ECFDFF] text-[#06C8E0] dark:bg-[#063543]/50">
                <Icon className="size-7" strokeWidth={1.5} />
            </span>
            <div>
                <h3 className="font-display text-xl font-semibold text-[#1C2D3F] dark:text-[#E8EEF3]">
                    {title}
                </h3>
                {description && (
                    <p className="mt-2 max-w-md text-[14px] text-[#5C7085] dark:text-[#AEBECC]">
                        {description}
                    </p>
                )}
            </div>
            {action}
        </div>
    );
}
