import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CreateSiteStep = 'site' | 'git' | 'configure' | 'review';

export const CREATE_SITE_STEPS: {
    id: CreateSiteStep;
    label: string;
    caption: string;
}[] = [
    { id: 'site', label: 'Site', caption: 'Domain and type' },
    { id: 'git', label: 'Repository', caption: 'Source code' },
    { id: 'configure', label: 'Configure', caption: 'Runtime and services' },
    { id: 'review', label: 'Review', caption: 'Confirm and create' },
];

export function stepIndex(step: CreateSiteStep): number {
    return CREATE_SITE_STEPS.findIndex((entry) => entry.id === step);
}

/**
 * Horizontal progress rail.
 *
 * Completed steps are clickable so a reviewer can go back and change an answer
 * without losing the rest of the form; steps ahead are not, because they may
 * depend on validation that has not run yet.
 */
export function CreateSiteSteps({
    step,
    onNavigate,
    className,
}: {
    step: CreateSiteStep;
    onNavigate: (step: CreateSiteStep) => void;
    className?: string;
}) {
    const current = stepIndex(step);

    return (
        <ol
            className={cn(
                'flex items-center gap-1 border-b border-base-300 bg-base-200/40 px-6 py-3',
                className,
            )}
        >
            {CREATE_SITE_STEPS.map((entry, index) => {
                const done = index < current;
                const active = index === current;

                return (
                    <li key={entry.id} className="flex flex-1 items-center">
                        <button
                            type="button"
                            disabled={!done}
                            onClick={() => done && onNavigate(entry.id)}
                            className={cn(
                                'group flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-1 text-left transition-colors',
                                done &&
                                    'cursor-pointer hover:bg-base-300/60',
                                !done && 'cursor-default',
                            )}
                        >
                            <span
                                className={cn(
                                    'flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors',
                                    active &&
                                        'bg-primary text-primary-content',
                                    done &&
                                        'bg-primary/15 text-primary group-hover:bg-primary/25',
                                    !active &&
                                        !done &&
                                        'bg-base-300 text-base-content/45',
                                )}
                            >
                                {done ? (
                                    <Check className="size-3.5" />
                                ) : (
                                    index + 1
                                )}
                            </span>

                            <span className="hidden min-w-0 flex-col sm:flex">
                                <span
                                    className={cn(
                                        'truncate text-[12px] leading-4 font-medium',
                                        active
                                            ? 'text-base-content'
                                            : 'text-base-content/60',
                                    )}
                                >
                                    {entry.label}
                                </span>
                                <span className="truncate text-[11px] leading-4 text-base-content/45">
                                    {entry.caption}
                                </span>
                            </span>
                        </button>

                        {index < CREATE_SITE_STEPS.length - 1 && (
                            <span
                                aria-hidden="true"
                                className={cn(
                                    'mx-1 h-px w-4 shrink-0 sm:w-6',
                                    index < current
                                        ? 'bg-primary/40'
                                        : 'bg-base-300',
                                )}
                            />
                        )}
                    </li>
                );
            })}
        </ol>
    );
}
