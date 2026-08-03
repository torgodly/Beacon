import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Beacon Design System · Inputs (PDF §11)
 *
 * radius-md (6), 1px border/input, control height from the comfortable
 * selection (44). The focus ring is the global :focus-visible outline —
 * a ring drawn with box-shadow gets clipped inside scrolling containers.
 *
 * Label goes above, always, via the Field wrapper below. A placeholder is an
 * example ("api.example.com"), never an instruction ("Enter your domain").
 *
 * `mono` is required for identifiers, paths, hosts, ports, versions and refs —
 * see the mono table in PDF §03.
 */
function Input({
    className,
    type,
    mono = false,
    ...props
}: React.ComponentProps<'input'> & { mono?: boolean }) {
    return (
        <input
            type={type}
            data-slot="input"
            className={cn(
                'flex h-11 w-full min-w-0 rounded-md border border-[var(--bc-border-input)]',
                'bg-surface px-3 text-fg',
                'transition-[border-color,background-color] duration-[--bc-duration-fast] ease-[--bc-ease-standard]',
                'placeholder:text-fg-disabled',
                'selection:bg-selected',
                'hover:border-border-hover',
                'disabled:cursor-not-allowed disabled:bg-[var(--bc-bg-subtle)] disabled:text-fg-disabled',
                'aria-invalid:border-danger',
                'file:inline-flex file:h-8 file:border-0 file:bg-transparent file:text-[14px] file:font-medium file:text-fg',
                mono
                    ? 'font-mono text-[13px] leading-5 tabular-nums'
                    : 'text-[14px] leading-5',
                className,
            )}
            {...props}
        />
    );
}

/**
 * Label → input → help/error, at the system's fixed spacing (6px each).
 *
 * Wiring the ids here means every field is programmatically labelled and
 * every error is linked with aria-describedby without the caller thinking
 * about it — the two most commonly skipped accessibility requirements.
 */
function Field({
    label,
    help,
    error,
    required,
    htmlFor,
    className,
    children,
}: {
    label: string;
    help?: React.ReactNode;
    error?: string | null;
    required?: boolean;
    htmlFor: string;
    className?: string;
    children: React.ReactNode;
}) {
    const errorId = `${htmlFor}-error`;
    const helpId = `${htmlFor}-help`;

    return (
        <div className={cn('flex flex-col gap-1.5', className)}>
            <label
                htmlFor={htmlFor}
                className="text-[14px] leading-5 font-medium text-fg"
            >
                {label}
                {/* Required is never signalled by colour alone. */}
                {required && (
                    <>
                        {' '}
                        <span className="text-fg-danger" aria-hidden="true">
                            *
                        </span>
                        <span className="sr-only">(required)</span>
                    </>
                )}
            </label>

            {children}

            {error ? (
                <p id={errorId} className="text-[13px] leading-5 text-fg-danger">
                    {error}
                </p>
            ) : help ? (
                <p id={helpId} className="text-[13px] leading-5 text-fg-muted">
                    {help}
                </p>
            ) : null}
        </div>
    );
}

export { Input, Field };
