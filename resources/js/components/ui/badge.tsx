import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { StatusIndicator, type StatusIndicatorTone } from '@/components/status-indicator';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
    [
        'inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap',
        'rounded-sm border px-2 py-0.5 text-[12px] leading-[18px] font-medium',
        'transition-[color,box-shadow,border-color] duration-[--bc-duration-fast]',
        '[&>svg]:size-3 [&>svg]:shrink-0',
    ].join(' '),
    {
        variants: {
            variant: {
                healthy:
                    'border-[#A6F4C5] bg-[#ECFDF3] text-[#15803D] dark:border-[#166534] dark:bg-[#052E16]/50 dark:text-[#4ADE80]',
                progress:
                    'border-[#DDD6FE] bg-[#F5F3FF] text-[#6D28D9] dark:border-[#5B21B6] dark:bg-[#2E1065]/50 dark:text-[#A78BFA]',
                warning:
                    'border-[#FDE68A] bg-[#FFFBEB] text-[#B45309] dark:border-[#92400E] dark:bg-[#451A03]/50 dark:text-[#FBBF24]',
                failed:
                    'border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C] dark:border-[#991B1B] dark:bg-[#450A0A]/50 dark:text-[#F87171]',
                brand:
                    'border-[#A5F2FB] bg-[#ECFDFF] text-[#0A788F] dark:border-[#106175] dark:bg-[#063543]/50 dark:text-[#22D0E8]',
                neutral:
                    'border-[var(--bc-border-default)] bg-[var(--bc-bg-neutral-subtle)] text-fg-muted',
                outline:
                    'border-[var(--bc-border-strong)] bg-transparent text-fg',
            },
        },
        defaultVariants: {
            variant: 'neutral',
        },
    },
);

const INDICATOR_TONE: Record<
    NonNullable<VariantProps<typeof badgeVariants>['variant']>,
    StatusIndicatorTone | null
> = {
    healthy: 'healthy',
    progress: 'progress',
    warning: 'warning',
    failed: 'failed',
    brand: null,
    neutral: null,
    outline: null,
};

function Badge({
    className,
    variant,
    asChild = false,
    showIndicator = true,
    ...props
}: React.ComponentProps<'span'> &
    VariantProps<typeof badgeVariants> & {
        asChild?: boolean;
        showIndicator?: boolean;
    }) {
    const Comp = asChild ? Slot : 'span';
    const indicatorTone = variant ? INDICATOR_TONE[variant] : null;

    return (
        <Comp
            data-slot="badge"
            className={cn(badgeVariants({ variant }), className)}
            {...props}
        >
            {showIndicator && indicatorTone && (
                <StatusIndicator tone={indicatorTone} />
            )}
            {props.children}
        </Comp>
    );
}

export function FrameworkBadge({
    type,
    className,
}: {
    type: string;
    className?: string;
}) {
    const label =
        {
            laravel: 'Laravel',
            nextjs: 'Next.js',
            nuxt: 'Nuxt',
            static: 'Static',
        }[type] ?? type;

    const frameworkClasses: Record<string, string> = {
        laravel:
            'border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C] dark:border-[#991B1B] dark:bg-[#450A0A]/50 dark:text-[#F87171]',
        nextjs:
            'border-[#D2DCE5] bg-[#E8EEF3] text-[#1C2D3F] dark:border-[#364554] dark:bg-[#263647] dark:text-[#E8EEF3]',
        nuxt: 'border-[#A6F4C5] bg-[#ECFDF3] text-[#15803D] dark:border-[#166534] dark:bg-[#052E16]/50 dark:text-[#4ADE80]',
        static:
            'border-[#A5F2FB] bg-[#ECFDFF] text-[#0A788F] dark:border-[#106175] dark:bg-[#063543]/50 dark:text-[#22D0E8]',
    };

    return (
        <span
            className={cn(
                'inline-flex w-fit shrink-0 items-center rounded-sm border px-2 py-0.5 text-[12px] leading-[18px] font-medium',
                frameworkClasses[type] ??
                    'border-[var(--bc-border-default)] bg-[var(--bc-bg-neutral-subtle)] text-fg-muted',
                className,
            )}
        >
            {label}
        </span>
    );
}

export { Badge, badgeVariants };
