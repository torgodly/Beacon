import type { ReactNode } from 'react';
import { Copy } from 'lucide-react';
import { toast } from '@/lib/toast';
import { useClipboard } from '@/hooks/use-clipboard';
import { cn } from '@/lib/utils';
import { forge } from '@/components/forge/forge-tokens';

export function ForgePageLayout({
    main,
    sidebar,
    className,
}: {
    main: ReactNode;
    sidebar: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'flex flex-col gap-8 lg:flex-row lg:items-start',
                className,
            )}
        >
            <div className="min-w-0 flex-1 space-y-8 lg:max-w-[900px]">{main}</div>
            <aside className="w-full shrink-0 space-y-6 md:w-52 lg:w-60">
                {sidebar}
            </aside>
        </div>
    );
}

export function ForgeDetailsSection({
    title,
    children,
    className,
}: {
    title: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <section className={cn(forge.card, 'overflow-hidden', className)}>
            <header className="border-b border-[#e2e8f0] px-4 py-3 dark:border-[#2e3032]">
                <h3 className="text-sm font-semibold text-[#0f172a] dark:text-[#f8fafc]">
                    {title}
                </h3>
            </header>
            <dl className="divide-y divide-[#e2e8f0] dark:divide-[#2e3032]">
                {children}
            </dl>
        </section>
    );
}

export function ForgeDetailRow({
    label,
    value,
    mono = false,
    copyable = false,
}: {
    label: string;
    value: ReactNode;
    mono?: boolean;
    copyable?: boolean;
}) {
    const [, copy] = useClipboard();
    const text = typeof value === 'string' ? value : null;

    return (
        <div className="flex items-start justify-between gap-3 px-4 py-2.5">
            <dt className="text-xs text-[#64748b] dark:text-[#94a3b8]">{label}</dt>
            <dd
                className={cn(
                    'flex items-center gap-1.5 text-right text-xs text-[#0f172a] dark:text-[#f8fafc]',
                    mono && 'font-mono',
                )}
            >
                {value}
                {copyable && text && (
                    <button
                        type="button"
                        className="rounded p-0.5 text-[#64748b] hover:text-[#18B69B]"
                        aria-label={`Copy ${label}`}
                        onClick={async () => {
                            const ok = await copy(text);
                            if (ok) {
                                toast.success(`${label} copied`);
                            }
                        }}
                    >
                        <Copy className="size-3.5" />
                    </button>
                )}
            </dd>
        </div>
    );
}
