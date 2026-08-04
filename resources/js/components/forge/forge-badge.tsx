import { Check } from 'lucide-react';
import { SiteFrameworkIcon } from '@/components/sites/site-framework-icon';
import { siteFrameworkLabel } from '@/lib/site-framework';
import { cn } from '@/lib/utils';

export function ForgeStatusBadge({
    label,
    pulse = false,
    className,
}: {
    label: string;
    pulse?: boolean;
    className?: string;
}) {
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400',
                className,
            )}
        >
            {pulse ? (
                <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" />
            ) : (
                <Check className="size-3" strokeWidth={2.5} />
            )}
            {label}
        </span>
    );
}

export function ForgeFrameworkBadge({
    type,
    className,
    showIcon = true,
}: {
    type: string;
    className?: string;
    showIcon?: boolean;
}) {
    const label = siteFrameworkLabel(type);

    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-2 py-0.5 font-mono text-xs text-[#475569] dark:border-[#2e3032] dark:bg-[#151718] dark:text-[#cbd5e1]',
                className,
            )}
        >
            {showIcon && <SiteFrameworkIcon type={type} size="sm" />}
            {label}
        </span>
    );
}

export function ForgeRuntimeBadge({
    label,
    className,
}: {
    label: string;
    className?: string;
}) {
    return (
        <span
            className={cn(
                'inline-flex rounded-md border border-[#e2e8f0] bg-[#f8fafc] px-2 py-0.5 font-mono text-xs text-[#475569] dark:border-[#2e3032] dark:bg-[#151718] dark:text-[#cbd5e1]',
                className,
            )}
        >
            {label}
        </span>
    );
}
