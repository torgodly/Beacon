import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

const alertVariants = cva('alert shadow-sm', {
    variants: {
        variant: {
            default: 'alert-info bg-base-100 text-base-content border border-base-300',
            destructive: 'alert-error text-error-content',
        },
    },
    defaultVariants: {
        variant: 'default',
    },
});

function Alert({
    className,
    variant,
    ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
    return (
        <div
            data-slot="alert"
            role="alert"
            className={cn(alertVariants({ variant }), className)}
            {...props}
        />
    );
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="alert-title"
            className={cn('font-medium tracking-tight', className)}
            {...props}
        />
    );
}

function AlertDescription({
    className,
    ...props
}: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="alert-description"
            className={cn('text-sm opacity-90 [&_p]:leading-relaxed', className)}
            {...props}
        />
    );
}

export { Alert, AlertTitle, AlertDescription };
