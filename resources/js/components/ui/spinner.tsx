import { Loader2Icon } from 'lucide-react';

import { cn } from '@/lib/utils';

type SpinnerTone = 'brand' | 'progress' | 'neutral';

const TONE_CLASSES: Record<SpinnerTone, string> = {
    brand: 'text-[#06C8E0]',
    progress: 'text-[#8B5CF6]',
    neutral: 'text-fg-muted',
};

function Spinner({
    className,
    tone = 'brand',
    ...props
}: React.ComponentProps<'svg'> & { tone?: SpinnerTone }) {
    return (
        <Loader2Icon
            role="status"
            aria-label="Loading"
            className={cn(
                'size-4 animate-spin',
                TONE_CLASSES[tone],
                className,
            )}
            {...props}
        />
    );
}

export { Spinner };
