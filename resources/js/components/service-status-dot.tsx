import { cn } from '@/lib/utils';

export function ServiceStatusDot({
    status,
    className,
}: {
    status: string;
    className?: string;
}) {
    const running =
        status === 'running' ||
        status === 'active' ||
        status === 'success' ||
        status === 'installed';

    return (
        <span
            className={cn(
                'size-2 shrink-0 rounded-full',
                running ? 'animate-pulse bg-emerald-500' : 'bg-rose-500',
                className,
            )}
            aria-hidden
        />
    );
}
