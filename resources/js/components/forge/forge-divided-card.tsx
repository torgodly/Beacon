import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { forge } from '@/components/forge/forge-tokens';

export function ForgeDividedCard({
    title,
    action,
    children,
    className,
}: {
    title: string;
    action?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <section className={cn(forge.card, 'overflow-hidden', className)}>
            <header className="flex items-center justify-between gap-3 border-b border-[#e2e8f0] px-4 py-3.5 dark:border-[#2e3032]">
                <h2 className="text-sm font-semibold text-[#0f172a] dark:text-[#f8fafc]">
                    {title}
                </h2>
                {action}
            </header>
            <div className={forge.divide}>{children}</div>
        </section>
    );
}

export function ForgeListRow({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'flex items-center gap-3 px-4 py-3 text-sm hover:bg-[#f8fafc] dark:hover:bg-[#151718]/60',
                className,
            )}
        >
            {children}
        </div>
    );
}
