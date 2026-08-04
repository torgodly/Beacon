import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva('btn rounded-xl', {
    variants: {
        variant: {
            primary: 'btn-primary',
            default: 'btn-primary',
            // hover:text-base-content is load-bearing, not redundant.
            //
            // daisyUI's btn-outline INVERTS on hover: it sets the background to
            // the content colour and the text to --color-base-100. Overriding
            // only the background left the inverted near-white text on a light
            // base-200 surface, so the label vanished into the button on hover.
            // Both halves of the pair have to be pinned to keep the contrast.
            secondary:
                'btn-outline bg-base-100 text-base-content hover:bg-base-200 hover:text-base-content hover:border-base-300',
            outline:
                'btn-outline bg-base-100 text-base-content hover:bg-base-200 hover:text-base-content hover:border-base-300',
            ghost: 'btn-ghost text-base-content hover:bg-base-200 hover:text-base-content',
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
    type,
    ...props
}: React.ComponentProps<'button'> &
    VariantProps<typeof buttonVariants> & {
        asChild?: boolean;
    }) {
    const Comp = asChild ? Slot : 'button';

    return (
        <Comp
            data-slot="button"
            // Default to "button", not the HTML default of "submit".
            //
            // A bare <button> inside a <form> submits it. That turned every
            // unannotated Button in a form into a submit control, including ones
            // that only meant to open a popover or toggle a section — and in the
            // site wizard that meant accidentally provisioning a site and a
            // database. Submitting is now something a caller opts into with an
            // explicit type="submit", which is the rarer and more deliberate case.
            type={asChild ? type : (type ?? 'button')}
            className={cn(buttonVariants({ variant, size, className }))}
            {...props}
        />
    );
}

export { Button, buttonVariants };
