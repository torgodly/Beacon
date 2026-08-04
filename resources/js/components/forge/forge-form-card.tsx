import type { PropsWithChildren, ReactNode } from 'react';
import { forge } from '@/components/forge/forge-tokens';
import { cn } from '@/lib/utils';

export function ForgeFormCard({
    title,
    description,
    children,
    className,
}: PropsWithChildren<{
    title: string;
    description?: string;
    className?: string;
}>) {
    return (
        <section className={cn(forge.card, 'overflow-hidden', className)}>
            <header className="border-b border-[#e2e8f0] px-4 py-3 dark:border-[#2e3032]">
                <h2 className="text-sm font-semibold text-[#0f172a] dark:text-[#f8fafc]">
                    {title}
                </h2>
                {description && (
                    <p className="mt-0.5 text-xs text-[#64748b]">{description}</p>
                )}
            </header>
            <div className="px-4 py-4">{children}</div>
        </section>
    );
}

export function ForgePageContent({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return <div className={cn('space-y-8', className)}>{children}</div>;
}
