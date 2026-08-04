import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CreateSiteStep = 'site' | 'git' | 'configure';

const STEPS: Array<{
    id: CreateSiteStep;
    label: string;
    description: string;
}> = [
    { id: 'site', label: 'Site', description: 'Domain and type' },
    { id: 'git', label: 'Git', description: 'Repository' },
    { id: 'configure', label: 'Configure', description: 'Runtime and env' },
];

export function CreateSiteStepper({
    step,
    className,
}: {
    step: CreateSiteStep;
    className?: string;
}) {
    const activeIndex = STEPS.findIndex((entry) => entry.id === step);

    return (
        <nav
            aria-label="Create site progress"
            className={cn('px-6 pt-4', className)}
        >
            <ol className="grid grid-cols-3 gap-2">
                {STEPS.map((entry, index) => {
                    const isComplete = index < activeIndex;
                    const isActive = index === activeIndex;

                    return (
                        <li
                            key={entry.id}
                            className={cn(
                                'rounded-xl border px-3 py-2.5 transition-colors',
                                isActive
                                    ? 'border-border-brand bg-brand-subtle'
                                    : isComplete
                                      ? 'border-success/30 bg-success/5'
                                      : 'border-base-300/80 bg-base-200/20',
                            )}
                        >
                            <div className="flex items-center gap-2">
                                <span
                                    className={cn(
                                        'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                                        isActive
                                            ? 'bg-primary text-primary-content'
                                            : isComplete
                                              ? 'bg-success text-success-content'
                                              : 'bg-base-300 text-base-content/60',
                                    )}
                                >
                                    {isComplete ? (
                                        <Check
                                            className="size-3.5"
                                            strokeWidth={2.5}
                                        />
                                    ) : (
                                        index + 1
                                    )}
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-sm font-medium text-base-content">
                                        {entry.label}
                                    </span>
                                    <span className="block truncate text-xs text-base-content/60">
                                        {entry.description}
                                    </span>
                                </span>
                            </div>
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
