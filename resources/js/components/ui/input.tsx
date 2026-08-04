import * as React from 'react';
import { formControlClassName } from '@/lib/form-control';
import { cn } from '@/lib/utils';

const controlClassName = `${formControlClassName} aria-invalid:border-error aria-invalid:text-error`;

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
                controlClassName,
                mono && 'font-mono tabular-nums',
                className,
            )}
            {...props}
        />
    );
}

function Textarea({
    className,
    mono = false,
    ...props
}: React.ComponentProps<'textarea'> & { mono?: boolean }) {
    return (
        <textarea
            data-slot="textarea"
            className={cn(
                controlClassName,
                'min-h-[4.5rem] resize-y',
                mono && 'font-mono tabular-nums',
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
        <div className={cn('w-full', className)}>
            <label htmlFor={htmlFor} className="bc-label">
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
            </label>

            <div className="mt-2">{children}</div>

            {error ? (
                <p id={errorId} className="bc-field-error mt-2">
                    {error}
                </p>
            ) : help ? (
                <p id={helpId} className="bc-field-help mt-2">
                    {help}
                </p>
            ) : null}
        </div>
    );
}

export { Field, Input, Textarea };
