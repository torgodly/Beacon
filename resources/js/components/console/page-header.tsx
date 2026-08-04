import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { ForgeEmptyState } from '@/components/forge/forge-empty-state';
import { PageHero } from '@/components/beacon/page-hero';

/** @deprecated Use PageHero — maps old eyebrow API to kicker. */
export function PageHeader({
    eyebrow,
    title,
    description,
    actions,
    className,
}: {
    eyebrow: string;
    title: string;
    description?: ReactNode;
    actions?: ReactNode;
    className?: string;
}) {
    return (
        <PageHero
            kicker={eyebrow}
            title={title}
            description={description}
            actions={actions}
            className={className}
        />
    );
}

export function EmptyState({
    icon,
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
        <ForgeEmptyState
            icon={icon}
            title={title}
            description={description}
            action={action}
            className={className}
        />
    );
}
