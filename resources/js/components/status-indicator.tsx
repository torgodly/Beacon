import { cn } from '@/lib/utils';

export type StatusIndicatorTone =
    | 'healthy'
    | 'progress'
    | 'warning'
    | 'failed'
    | 'neutral';

const TONE_CLASSES: Record<
    StatusIndicatorTone,
    { dot: string; ring?: string; pulse?: boolean; spin?: boolean }
> = {
    healthy: {
        dot: 'bg-[#21C55D]',
        pulse: true,
    },
    progress: {
        dot: 'border-2 border-[#8B5CF6] border-t-transparent',
        ring: 'shadow-[0_0_12px_rgba(139,92,246,0.4)]',
        spin: true,
    },
    warning: {
        dot: 'bg-[#F59E0B]',
    },
    failed: {
        dot: 'bg-[#EF4444]',
    },
    neutral: {
        dot: 'bg-[var(--bc-slate-400)]',
    },
};

/**
 * Live status dot / spinner used beside badges and inline labels.
 */
export function StatusIndicator({
    tone,
    size = 'sm',
    className,
}: {
    tone: StatusIndicatorTone;
    size?: 'sm' | 'md';
    className?: string;
}) {
    const spec = TONE_CLASSES[tone];
    const dimension = size === 'md' ? 'size-2.5' : 'size-2';

    return (
        <span
            aria-hidden="true"
            className={cn(
                'inline-flex shrink-0 rounded-full',
                dimension,
                spec.dot,
                spec.ring,
                spec.pulse && 'animate-pulse',
                spec.spin && 'animate-spin',
                className,
            )}
        />
    );
}
