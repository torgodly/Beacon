import { AlertCircle, Check } from 'lucide-react';
import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Beacon's form language.
 *
 * Four rules the whole panel follows, so a form never has to be redesigned
 * locally:
 *
 *  1. One question per row. A label, the control, and at most one line of help.
 *  2. Help text is permanent; error text replaces it in place. Nothing reflows
 *     when validation fails, so the form does not jump under the cursor.
 *  3. Grouping is done with <FormSection>, never with bare margins, so every
 *     screen has the same rhythm.
 *  4. Destructive or provisioning actions never share a slot with a navigation
 *     action — see <FormActions align="between">.
 */

/* ------------------------------------------------------------------ Section */

function FormSection({
    title,
    description,
    aside,
    children,
    className,
}: {
    title?: React.ReactNode;
    description?: React.ReactNode;
    aside?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <section className={cn('flex flex-col gap-4', className)}>
            {(title || description || aside) && (
                <div className="flex items-start justify-between gap-4">
                    <div className="flex flex-col gap-1">
                        {title && (
                            <h3 className="text-sm leading-5 font-semibold text-base-content">
                                {title}
                            </h3>
                        )}
                        {description && (
                            <p className="text-[13px] leading-5 text-base-content/60">
                                {description}
                            </p>
                        )}
                    </div>
                    {aside && <div className="shrink-0">{aside}</div>}
                </div>
            )}
            <div className="flex flex-col gap-4">{children}</div>
        </section>
    );
}

/** Vertical rule between sections. Cheaper than a Card for in-form grouping. */
function FormDivider({ className }: { className?: string }) {
    return <div className={cn('h-px w-full bg-base-300/70', className)} />;
}

/** Two-column grid that collapses on small screens. */
function FormGrid({
    columns = 2,
    children,
    className,
}: {
    columns?: 1 | 2 | 3;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'grid gap-4',
                columns === 2 && 'sm:grid-cols-2',
                columns === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
                className,
            )}
        >
            {children}
        </div>
    );
}

/* -------------------------------------------------------------------- Field */

function FieldMessage({
    error,
    help,
    id,
}: {
    error?: string | null;
    help?: React.ReactNode;
    id: string;
}) {
    // Reserve the row whenever either can appear, so swapping help for an error
    // does not change the element's height and shift the rest of the form.
    if (!error && !help) {
        return null;
    }

    return (
        <p
            id={id}
            className={cn(
                'mt-2 flex items-start gap-1.5',
                error ? 'bc-field-error' : 'bc-field-help',
            )}
        >
            {error && (
                <AlertCircle
                    className="mt-px size-3.5 shrink-0"
                    aria-hidden="true"
                />
            )}
            <span>{error || help}</span>
        </p>
    );
}

function Field({
    label,
    help,
    error,
    required,
    optional,
    htmlFor,
    hint,
    className,
    children,
}: {
    label?: React.ReactNode;
    help?: React.ReactNode;
    error?: string | null;
    required?: boolean;
    /** Renders a quiet "Optional" marker — better than leaving it ambiguous. */
    optional?: boolean;
    htmlFor: string;
    /** Right-aligned affordance on the label row (a link, a counter). */
    hint?: React.ReactNode;
    className?: string;
    children: React.ReactNode;
}) {
    const messageId = `${htmlFor}-message`;

    return (
        <div className={cn('flex w-full flex-col', className)}>
            {(label || hint) && (
                <div className="flex items-baseline justify-between gap-3">
                    {label && (
                        <label htmlFor={htmlFor} className="bc-label">
                            {label}
                            {required && (
                                <>
                                    <span
                                        className="ml-0.5 text-error"
                                        aria-hidden="true"
                                    >
                                        *
                                    </span>
                                    <span className="sr-only">(required)</span>
                                </>
                            )}
                            {optional && (
                                <span className="ml-1.5 font-normal text-base-content/45">
                                    Optional
                                </span>
                            )}
                        </label>
                    )}
                    {hint && (
                        <span className="text-sm/6 text-base-content/55">
                            {hint}
                        </span>
                    )}
                </div>
            )}

            <div className="mt-2">{children}</div>

            <FieldMessage error={error} help={help} id={messageId} />
        </div>
    );
}

/* ------------------------------------------------------------------ Toggles */

/**
 * A setting that is on or off, with room to explain what it does.
 *
 * The whole row is the hit target — a 13px checkbox is not one.
 */
function ToggleRow({
    label,
    description,
    checked,
    onChange,
    disabled,
    id,
    className,
}: {
    label: React.ReactNode;
    description?: React.ReactNode;
    checked: boolean;
    onChange: (next: boolean) => void;
    disabled?: boolean;
    id: string;
    className?: string;
}) {
    return (
        <label
            htmlFor={id}
            className={cn(
                'group flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-base-300 bg-base-100 px-4 py-3 transition-colors',
                disabled
                    ? 'cursor-not-allowed opacity-60'
                    : 'hover:border-base-content/20 hover:bg-base-200/60',
                className,
            )}
        >
            <span className="flex flex-col gap-0.5">
                <span className="text-[13px] leading-5 font-medium text-base-content">
                    {label}
                </span>
                {description && (
                    <span className="text-[12px] leading-4 text-base-content/60">
                        {description}
                    </span>
                )}
            </span>
            <input
                id={id}
                type="checkbox"
                role="switch"
                className="toggle toggle-sm toggle-primary mt-0.5 shrink-0"
                checked={checked}
                disabled={disabled}
                onChange={(event) => onChange(event.target.checked)}
            />
        </label>
    );
}

/* -------------------------------------------------------------- ChoiceCards */

/**
 * Large, clickable option cards — for choices worth showing rather than
 * hiding in a <select>: site type, database strategy, runtime.
 *
 * Rendered as real radio inputs so keyboard and screen-reader behaviour comes
 * for free, with the input visually hidden behind the card.
 */
function ChoiceCardGroup({
    columns = 2,
    children,
    className,
    label,
}: {
    columns?: 1 | 2 | 3 | 4;
    children: React.ReactNode;
    className?: string;
    label?: string;
}) {
    return (
        <div
            role="radiogroup"
            aria-label={label}
            className={cn(
                'grid gap-2.5',
                columns === 2 && 'sm:grid-cols-2',
                columns === 3 && 'sm:grid-cols-3',
                columns === 4 && 'grid-cols-2 sm:grid-cols-4',
                className,
            )}
        >
            {children}
        </div>
    );
}

function ChoiceCard({
    name,
    value,
    checked,
    onSelect,
    icon,
    title,
    description,
    badge,
    disabled,
    className,
}: {
    name: string;
    value: string;
    checked: boolean;
    onSelect: (value: string) => void;
    icon?: React.ReactNode;
    title: React.ReactNode;
    description?: React.ReactNode;
    badge?: React.ReactNode;
    disabled?: boolean;
    className?: string;
}) {
    return (
        <label
            className={cn(
                'relative flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-all',
                'focus-within:ring-2 focus-within:ring-primary/40 focus-within:ring-offset-1 focus-within:ring-offset-base-100',
                checked
                    ? 'border-primary bg-primary/[0.06] shadow-[0_0_0_1px_var(--color-primary)]'
                    : 'border-base-300 bg-base-100 hover:border-base-content/25 hover:bg-base-200/50',
                disabled && 'pointer-events-none opacity-50',
                className,
            )}
        >
            <input
                type="radio"
                name={name}
                value={value}
                checked={checked}
                disabled={disabled}
                onChange={() => onSelect(value)}
                className="sr-only"
            />

            {icon && (
                <span
                    className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors',
                        checked
                            ? 'border-primary/30 bg-primary/10 text-primary'
                            : 'border-base-300 bg-base-200/70 text-base-content/70',
                    )}
                >
                    {icon}
                </span>
            )}

            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-center gap-2">
                    <span className="truncate text-[13px] leading-5 font-medium text-base-content">
                        {title}
                    </span>
                    {badge}
                </span>
                {description && (
                    <span className="text-[12px] leading-4 text-base-content/60">
                        {description}
                    </span>
                )}
            </span>

            {checked && (
                <Check
                    className="size-4 shrink-0 text-primary"
                    aria-hidden="true"
                />
            )}
        </label>
    );
}

/* ------------------------------------------------------------------ Actions */

/**
 * Form footer.
 *
 * `align="between"` puts the secondary action hard left and the primary hard
 * right. That separation is deliberate: a wizard's "Continue" and its final
 * "Create" must never appear in the same place on consecutive screens, or a
 * second click lands on a control that provisions real infrastructure.
 */
function FormActions({
    align = 'end',
    children,
    className,
}: {
    align?: 'end' | 'between';
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'flex items-center gap-2',
                align === 'between' ? 'justify-between' : 'justify-end',
                className,
            )}
        >
            {children}
        </div>
    );
}

/** Read-only key/value line — for review screens and summaries. */
function SummaryRow({
    label,
    value,
    mono,
}: {
    label: React.ReactNode;
    value: React.ReactNode;
    mono?: boolean;
}) {
    return (
        <div className="flex items-baseline justify-between gap-4 py-1.5">
            <dt className="shrink-0 text-[12px] leading-5 text-base-content/55">
                {label}
            </dt>
            <dd
                className={cn(
                    'min-w-0 truncate text-right text-[13px] leading-5 font-medium text-base-content',
                    mono && 'font-mono tabular-nums',
                )}
            >
                {value}
            </dd>
        </div>
    );
}

export {
    ChoiceCard,
    ChoiceCardGroup,
    Field,
    FieldMessage,
    FormActions,
    FormDivider,
    FormGrid,
    FormSection,
    SummaryRow,
    ToggleRow,
};
