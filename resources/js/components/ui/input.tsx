import * as React from 'react';
import { cn } from '@/lib/utils';

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
                'input input-bordered w-full rounded-xl bg-base-100 text-base-content',
                'h-11 min-h-11',
                'disabled:cursor-not-allowed disabled:bg-base-200 disabled:text-base-content/50',
                'aria-invalid:border-error aria-invalid:text-error',
                mono
                    ? 'font-mono text-sm leading-5 tabular-nums'
                    : 'text-sm leading-5',
                className,
            )}
            {...props}
        />
    );
}

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
        <div className={cn('form-control w-full gap-1.5', className)}>
            <label htmlFor={htmlFor} className="label py-0">
                <span className="label-text font-medium text-base-content">
                    {label}
                    {required && (
                        <>
                            {' '}
                            <span className="text-error" aria-hidden="true">
                                *
                            </span>
                            <span className="sr-only">(required)</span>
                        </>
                    )}
                </span>
            </label>

            {children}

            {error ? (
                <label id={errorId} className="label py-0">
                    <span className="label-text-alt text-error">{error}</span>
                </label>
            ) : help ? (
                <label id={helpId} className="label py-0">
                    <span className="label-text-alt text-base-content/70">
                        {help}
                    </span>
                </label>
            ) : null}
        </div>
    );
}

export { Input, Field };
