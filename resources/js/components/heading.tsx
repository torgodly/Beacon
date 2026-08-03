import { cn } from '@/lib/utils';

/**
 * Section heading.
 *
 * `eyebrow` renders the design system's mono uppercase `overline` role, which
 * is what keeps section headings in the same operator-console language as the
 * page mastheads and panels.
 */
export default function Heading({
    title,
    description,
    eyebrow,
    variant = 'default',
    className,
}: {
    title: string;
    description?: string;
    eyebrow?: string;
    variant?: 'default' | 'small';
    className?: string;
}) {
    const small = variant === 'small';

    return (
        <header className={cn(small ? 'space-y-0.5' : 'space-y-1', className)}>
            {eyebrow && (
                <p className="text-overline font-mono text-fg-subtle">
                    {eyebrow}
                </p>
            )}

            <h2
                className={
                    small
                        ? // heading-5 · 16/24/600
                          'text-[16px] leading-6 font-semibold text-fg-strong'
                        : // heading-3 · 20/28/600
                          'text-[20px] leading-7 font-semibold tracking-[-0.005em] text-fg-strong'
                }
            >
                {title}
            </h2>

            {description && (
                <p className="text-[14px] leading-[22px] text-fg-muted">
                    {description}
                </p>
            )}
        </header>
    );
}
