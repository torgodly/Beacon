import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Compact label/control rows for settings dialogs — Beacon tokens, not Forge chrome. */
export function ForgeFormRows({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'divide-y divide-[var(--bc-border-default)] rounded-md border border-[var(--bc-border-default)]',
                className,
            )}
        >
            {children}
        </div>
    );
}

export function ForgeFormRow({
    label,
    htmlFor,
    children,
    className,
}: {
    label: string;
    htmlFor?: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'grid gap-2 px-4 py-3 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:items-center sm:gap-4',
                className,
            )}
        >
            {htmlFor ? (
                <label
                    htmlFor={htmlFor}
                    className="font-mono text-[13px] leading-5 text-fg-muted"
                >
                    {label}
                </label>
            ) : (
                <span className="font-mono text-[13px] leading-5 text-fg-muted">
                    {label}
                </span>
            )}
            <div className="min-w-0">{children}</div>
        </div>
    );
}

export function ForgeFormPreview({
    children,
    label = 'Preview',
}: {
    children: ReactNode;
    label?: string;
}) {
    return (
        <div className="border-t border-[var(--bc-border-default)] bg-[var(--bc-bg-subtle)] px-4 py-3">
            <p className="text-[12px] font-medium tracking-wide text-fg-muted uppercase">
                {label}
            </p>
            <div className="mt-2 break-all font-mono text-[13px] leading-5 text-fg-code">
                {children}
            </div>
        </div>
    );
}

export function ForgeFormTabs({
    tabs,
    value,
    onChange,
}: {
    tabs: Array<{ value: string; label: string }>;
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Process type">
            {tabs.map((tab) => (
                <button
                    key={tab.value}
                    type="button"
                    role="tab"
                    aria-selected={value === tab.value}
                    className={cn(
                        'rounded-md border px-3 py-1.5 text-[13px] font-medium transition-colors duration-[--bc-duration-fast]',
                        value === tab.value
                            ? 'border-border-brand bg-brand-subtle text-fg-brand'
                            : 'border-[var(--bc-border-default)] text-fg-muted hover:border-border-hover hover:text-fg',
                    )}
                    onClick={() => onChange(tab.value)}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
}
