import type { PropsWithChildren } from 'react';
import { cn } from '@/lib/utils';
import { forge } from '@/components/forge/forge-tokens';

export function ForgeContainer({
    children,
    className,
}: PropsWithChildren<{ className?: string }>) {
    return (
        <div className={cn(forge.container, className)}>{children}</div>
    );
}
