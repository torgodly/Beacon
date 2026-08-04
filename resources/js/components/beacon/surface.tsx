import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Beacon v2 surface — glass card with optional cyan accent rail.
 * Replaces the old operator-console Panel look.
 */
export function Surface({
    title,
    description,
    icon: Icon,
    actions,
    footer,
    flush = false,
    accent = false,
    className,
    children,
}: {
    title?: ReactNode;
    description?: ReactNode;
    icon?: LucideIcon;
    actions?: ReactNode;
    footer?: ReactNode;
    flush?: boolean;
    accent?: boolean;
    className?: string;
    children?: ReactNode;
}) {
    const hasHeader = Boolean(title || description || actions || Icon);

    return (
        <section
            className={cn(
                'relative overflow-hidden rounded-2xl border border-[#E8EEF3]/90',
                'bg-white/85 shadow-[0_8px_30px_rgba(5,19,30,0.04)] backdrop-blur-md',
                'dark:border-[#263647] dark:bg-[#1C2D3F]/75 dark:shadow-[0_8px_40px_rgba(0,0,0,0.35)]',
                accent &&
                    'before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-[#06C8E0] before:to-transparent',
                className,
            )}
        >
            {hasHeader && (
                <header className="flex items-start gap-4 border-b border-[#E8EEF3]/80 px-6 py-5 dark:border-[#263647]/80">
                    {Icon && (
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#ECFDFF] text-[#04A3BC] dark:bg-[#063543]/50 dark:text-[#22D0E8]">
                            <Icon aria-hidden="true" strokeWidth={1.75} className="size-5" />
                        </span>
                    )}
                    <div className="min-w-0 flex-1">
                        {title && (
                            <h2 className="text-[17px] font-semibold tracking-tight text-[#1C2D3F] dark:text-[#E8EEF3]">
                                {title}
                            </h2>
                        )}
                        {description && (
                            <p className="mt-1 text-[14px] leading-relaxed text-[#5C7085] dark:text-[#AEBECC]">
                                {description}
                            </p>
                        )}
                    </div>
                    {actions && (
                        <div className="flex shrink-0 items-center gap-2">{actions}</div>
                    )}
                </header>
            )}

            {children != null && (
                <div className={cn('min-w-0', !flush && 'px-6 py-5')}>{children}</div>
            )}

            {footer && (
                <footer className="border-t border-[#E8EEF3]/80 bg-[#F5F8FA]/60 px-6 py-3 dark:border-[#263647] dark:bg-[#05131E]/40">
                    {footer}
                </footer>
            )}
        </section>
    );
}

export function MetricTile({
    label,
    value,
    hint,
    tone = 'default',
    className,
}: {
    label: string;
    value: ReactNode;
    hint?: string;
    tone?: 'default' | 'brand' | 'success' | 'warning' | 'danger';
    className?: string;
}) {
    const valueTone = {
        default: 'text-[#1C2D3F] dark:text-[#E8EEF3]',
        brand: 'text-[#04A3BC] dark:text-[#22D0E8]',
        success: 'text-[#15803D] dark:text-[#4ADE80]',
        warning: 'text-[#B45309] dark:text-[#FBBF24]',
        danger: 'text-[#B91C1C] dark:text-[#F87171]',
    }[tone];

    return (
        <div
            className={cn(
                'flex flex-col gap-1 rounded-xl border border-[#E8EEF3] bg-white/70 px-4 py-3 dark:border-[#263647] dark:bg-[#1C2D3F]/50',
                className,
            )}
        >
            <span className="text-[11px] font-semibold tracking-[0.14em] text-[#8095A8] uppercase dark:text-[#8095A8]">
                {label}
            </span>
            <span
                className={cn(
                    'font-display text-2xl font-bold tracking-tight tabular-nums',
                    valueTone,
                )}
            >
                {value}
            </span>
            {hint && (
                <span className="text-[12px] text-[#5C7085] dark:text-[#AEBECC]">{hint}</span>
            )}
        </div>
    );
}
