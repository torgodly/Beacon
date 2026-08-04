import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

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
                'divide-y divide-[#e2e8f0] rounded-lg border border-[#e2e8f0] dark:divide-[#2e3032] dark:border-[#2e3032]',
                className,
            )}
        >
            {children}
        </div>
    );
}

export function ForgeFormRow({
    label,
    children,
    suffix,
    className,
}: {
    label: string;
    children: ReactNode;
    suffix?: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'flex flex-col items-start justify-between gap-x-3 gap-y-2 px-5 py-4 sm:flex-row sm:items-center sm:gap-y-3',
                className,
            )}
        >
            <div className="w-32 shrink-0 font-mono text-sm tracking-tight text-[#0f172a] dark:text-[#f8fafc]">
                {label}
            </div>
            <div className="w-full min-w-0 flex-1">{children}</div>
            {suffix !== undefined && (
                <div className="flex w-20 shrink-0 justify-center">{suffix}</div>
            )}
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
        <div className="border-t border-[#e2e8f0] bg-[#f8fafc] px-5 py-4 dark:border-[#2e3032] dark:bg-[#151718]/40">
            <span className="inline-flex items-center rounded-md border border-[#e2e8f0] bg-white px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[#64748b] dark:border-[#2e3032] dark:bg-[#151718]">
                {label}
            </span>
            <div className="mt-3 font-mono text-sm text-[#0f172a] dark:text-[#f8fafc]">
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
        <nav
            aria-label="Tabs"
            className="relative flex gap-6 border-b border-[#e2e8f0] dark:border-[#2e3032]"
        >
            {tabs.map((tab) => (
                <button
                    key={tab.value}
                    type="button"
                    className={cn(
                        'relative border-b-2 px-1 py-3 text-sm font-medium transition-colors',
                        value === tab.value
                            ? 'border-[#18B69B] text-[#0f172a] dark:text-[#f8fafc]'
                            : 'border-transparent text-[#64748b] hover:text-[#0f172a] dark:hover:text-[#f8fafc]',
                    )}
                    onClick={() => onChange(tab.value)}
                >
                    {tab.label}
                </button>
            ))}
        </nav>
    );
}
