import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Beacon Design System · Buttons (PDF §11)
 *
 * Four variants, one primary per view. Sizes are the system's control
 * heights: sm 28 / md 36 / lg 44. Radius is always radius-md (6) — a
 * pill-shaped button reads consumer-app and contradicts a blocky mark.
 *
 * The focus ring comes from the global :focus-visible outline rule rather
 * than a per-component box-shadow, because outline survives overflow:hidden
 * inside scrolling tables.
 */
const buttonVariants = cva(
    [
        'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap',
        'rounded-md font-medium',
        'transition-[background-color,border-color,box-shadow,color]',
        'duration-[--bc-duration-fast] ease-[--bc-ease-standard]',
        'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#18B69B]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#151718]',
        '[&_svg]:pointer-events-none [&_svg]:shrink-0',
        "[&_svg:not([class*='size-'])]:size-4",
        'aria-invalid:border-danger',
    ].join(' '),
    {
        variants: {
            variant: {
                /** Forge primary — solid dark / inverted in dark mode */
                primary:
                    'bg-zinc-900 text-white shadow-xs hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 active:scale-[0.98]',
                /** transparent + 1px border/strong + fg/default */
                secondary:
                    'border border-[#e2e8f0] bg-white text-sm font-medium text-[#0f172a] hover:bg-[#f8fafc] dark:border-[#2e3032] dark:bg-[#1f2021] dark:text-[#f8fafc] dark:hover:bg-[#151718]',
                /** transparent + fg/muted */
                ghost: 'bg-transparent text-fg-muted hover:bg-[var(--bc-bg-hover)] hover:text-fg active:bg-[var(--bc-bg-active)]',
                /** bg/danger + fg/on-danger */
                danger: 'bg-danger text-[var(--bc-fg-on-danger)] hover:bg-[var(--bc-bg-danger-hover)] active:bg-[var(--bc-red-700)]',
                /** Not a button variant in the system — kept for inline text actions. */
                link: 'text-fg-link underline-offset-4 hover:text-[var(--bc-fg-link-hover)] hover:underline',

                /* ---- shadcn aliases -------------------------------------
                 * The pre-existing call sites use these names. They resolve
                 * to the same recipes so nothing shifts visually on upgrade;
                 * screens migrate to the canonical names as they are
                 * redesigned, which is also when "one primary per view" gets
                 * enforced. Do not use these in new code. */
                default:
                    'bg-zinc-900 text-white shadow-xs hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 active:scale-[0.98]',
                outline:
                    'border border-[#e2e8f0] bg-white text-sm font-medium text-[#0f172a] hover:bg-[#f8fafc] dark:border-[#2e3032] dark:bg-[#1f2021] dark:text-[#f8fafc] dark:hover:bg-[#151718]',
                destructive:
                    'bg-danger text-[var(--bc-fg-on-danger)] hover:bg-[var(--bc-bg-danger-hover)] active:bg-[var(--bc-red-700)]',
            },
            size: {
                /** 28px · label-sm 13/18/500 · 14px icon */
                sm: "h-7 gap-1.5 px-3 text-[13px] leading-[18px] [&_svg:not([class*='size-'])]:size-3.5",
                /** 36px · label-md 14/20/500 · 16px icon */
                md: 'h-9 px-4 text-[14px] leading-5',
                /** 44px · 16/24/500 · 20px icon */
                lg: "h-11 px-5 text-[16px] leading-6 [&_svg:not([class*='size-'])]:size-5",
                'icon-sm': 'size-7 p-0',
                icon: 'size-9 p-0',
                'icon-lg': "size-11 p-0 [&_svg:not([class*='size-'])]:size-5",
                /** shadcn alias — same 36px as md. */
                default: 'h-9 px-4 text-[14px] leading-5',
            },
        },
        defaultVariants: {
            // Matches the previous shadcn default so untyped buttons keep
            // their filled-primary appearance until a screen is redesigned.
            variant: 'default',
            size: 'md',
        },
    },
);

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
