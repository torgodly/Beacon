import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva('btn rounded-xl', {
    variants: {
        variant: {
            primary: 'btn-primary',
            default: 'btn-primary',
            secondary: 'btn-outline bg-base-100 text-base-content hover:bg-base-200',
            outline: 'btn-outline bg-base-100 text-base-content hover:bg-base-200',
            ghost: 'btn-ghost text-base-content',
            danger: 'btn-error text-error-content',
            destructive: 'btn-error text-error-content',
            link: 'btn-link text-primary',
        },
        size: {
            sm: 'btn-sm h-8 min-h-8',
            md: 'h-10 min-h-10',
            lg: 'btn-lg h-11 min-h-11',
            'icon-sm': 'btn-sm btn-square h-8 w-8 min-h-8',
            icon: 'btn-square h-10 w-10 min-h-10',
            'icon-lg': 'btn-lg btn-square h-11 w-11 min-h-11',
            default: 'h-10 min-h-10',
        },
    },
    defaultVariants: {
        variant: 'default',
        size: 'md',
    },
});

function Button({
    className,
    variant,
    size,
    asChild = false,
    ...props
}: React.ComponentProps<'button'> &
    VariantProps<typeof buttonVariants> & {
        asChild?: boolean;
    }) {
    const Comp = asChild ? Slot : 'button';

    return (
        <Comp
            data-slot="button"
            className={cn(buttonVariants({ variant, size, className }))}
            {...props}
        />
    );
}

export { Button, buttonVariants };
