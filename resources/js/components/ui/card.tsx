import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Beacon Design System · Card
 *
 * Elevation level 1: bg/surface + 1px border/default. Dark interfaces do not
 * get depth from shadows — canvas→surface is only a 1.34:1 step, so the 1px
 * border is what actually draws the edge.
 *
 * radius-lg (8). Padding follows the comfortable selection: space-6 (24)
 * default, with `dense` (16) and `roomy` (24) available. Per the nesting
 * rule, children of a 24-padded radius-8 card sit at radius-sm or below —
 * child radius = parent radius − parent padding, floored at 4.
 */
function Card({
    className,
    padding = 'default',
    ...props
}: React.ComponentProps<'div'> & { padding?: 'none' | 'dense' | 'default' }) {
    return (
        <div
            data-slot="card"
            className={cn(
                'flex flex-col rounded-lg bg-surface text-fg',
                'border border-[var(--bc-border-default)]',
                padding === 'none' && 'gap-0',
                padding === 'dense' && 'gap-4 py-4',
                padding === 'default' && 'gap-5 py-6',
                className,
            )}
            data-padding={padding}
            {...props}
        />
    );
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="card-header"
            className={cn(
                'flex flex-col gap-1 px-6',
                'group-data-[padding=dense]/card:px-4',
                className,
            )}
            {...props}
        />
    );
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="card-title"
            // heading-5 · 16/24/600
            className={cn(
                'text-[16px] leading-6 font-semibold text-fg-strong',
                className,
            )}
            {...props}
        />
    );
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="card-description"
            // body-sm · 13/20/400
            className={cn('text-[13px] leading-5 text-fg-muted', className)}
            {...props}
        />
    );
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="card-content"
            className={cn('px-6', className)}
            {...props}
        />
    );
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="card-footer"
            className={cn(
                'flex items-center gap-3 px-6', // button group gap = space-3
                className,
            )}
            {...props}
        />
    );
}

/** Full-bleed divider inside a card — never rounded, never inset. */
function CardSeparator({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="card-separator"
            role="separator"
            className={cn('h-px w-full bg-[var(--bc-border-subtle)]', className)}
            {...props}
        />
    );
}

export {
    Card,
    CardHeader,
    CardFooter,
    CardTitle,
    CardDescription,
    CardContent,
    CardSeparator,
};
