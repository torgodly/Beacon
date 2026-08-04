import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { forge } from '@/components/forge/forge-tokens';

export function ForgeEmptyState({
    icon: Icon,
    title,
    description,
    action,
    className,
}: {
    icon: LucideIcon;
    title: string;
    description?: string;
    action?: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                forge.card,
                'flex flex-col items-center px-6 py-14 text-center',
                className,
            )}
        >
            <span className="flex size-12 items-center justify-center rounded-full bg-[#18B69B]/10 text-[#18B69B] ring-1 ring-[#18B69B]/20">
                <Icon className="size-6" strokeWidth={1.75} />
            </span>
            <h3 className="mt-4 text-sm font-semibold text-[#0f172a] dark:text-[#f8fafc]">
                {title}
            </h3>
            {description && (
                <p className="mt-2 max-w-md text-sm leading-relaxed text-[#64748b] dark:text-[#94a3b8]">
                    {description}
                </p>
            )}
            {action ? <div className="mt-6">{action}</div> : null}
        </div>
    );
}

export function ForgeActionGroup({
    children,
    className,
    layout = 'horizontal',
}: {
    children: ReactNode;
    className?: string;
    layout?: 'horizontal' | 'vertical';
}) {
    return (
        <div
            className={cn(
                layout === 'vertical'
                    ? 'flex flex-col gap-3 [&_button]:w-full'
                    : 'flex flex-wrap items-center gap-3',
                className,
            )}
        >
            {children}
        </div>
    );
}

export function ForgeActionsPanel({
    title = 'Actions',
    children,
    className,
    layout = 'vertical',
}: {
    title?: string;
    children: ReactNode;
    className?: string;
    layout?: 'horizontal' | 'vertical';
}) {
    return (
        <section className={cn(forge.card, 'overflow-hidden', className)}>
            <header className="border-b border-[#e2e8f0] px-4 py-3 dark:border-[#2e3032]">
                <h3 className="text-sm font-semibold text-[#0f172a] dark:text-[#f8fafc]">
                    {title}
                </h3>
            </header>
            <div className="p-4">
                <ForgeActionGroup layout={layout}>{children}</ForgeActionGroup>
            </div>
        </section>
    );
}
