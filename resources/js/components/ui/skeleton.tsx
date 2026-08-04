import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="skeleton"
            className={cn(
                'animate-pulse rounded-lg bg-[#E8EEF3] dark:bg-[#263647]',
                className,
            )}
            {...props}
        />
    );
}

/** Skeleton block matching a Panel header + body. */
function PanelSkeleton({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                'overflow-hidden rounded-xl border border-[#E8EEF3] bg-white dark:border-[#263647] dark:bg-[#1C2D3F]/80',
                className,
            )}
        >
            <div className="space-y-2 border-b border-[var(--bc-border-subtle)] px-6 py-4">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-5 w-48" />
            </div>
            <div className="space-y-3 px-6 py-5">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <Skeleton className="h-4 w-2/3" />
            </div>
        </div>
    );
}

export { Skeleton, PanelSkeleton };
