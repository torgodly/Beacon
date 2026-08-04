import * as React from 'react';
import { cn } from '@/lib/utils';

function Card({
    className,
    padding = 'default',
    ...props
}: React.ComponentProps<'div'> & { padding?: 'none' | 'dense' | 'default' }) {
    return (
        <div
            data-slot="card"
            className={cn(
                'card bg-base-100 text-base-content rounded-2xl border border-base-300 shadow-sm',
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
            className={cn(
                'text-base font-semibold text-base-content',
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
            className={cn('text-sm text-base-content/70', className)}
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
            className={cn('flex items-center gap-3 px-6', className)}
            {...props}
        />
    );
}

function CardSeparator({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="card-separator"
            className={cn('divider my-0 w-full', className)}
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
