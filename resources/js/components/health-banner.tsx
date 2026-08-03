import { usePage } from '@inertiajs/react';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

type HealthIssue = {
    severity: string;
    message: string;
};

type BeaconShared = {
    health: {
        healthy: boolean;
        issues: HealthIssue[];
    };
};

/**
 * Degraded-install banner.
 *
 * Built on the design system's semantic tokens rather than the generic shadcn
 * Alert, which rendered destructive text on a destructive fill. Severity is
 * carried by an icon and an explicit "critical"/"warning" label as well as
 * colour, so the banner still reads in greyscale.
 */
export function HealthBanner() {
    const { beacon } = usePage().props as { beacon?: BeaconShared };

    if (!beacon || beacon.health.healthy || beacon.health.issues.length === 0) {
        return null;
    }

    const issues = beacon.health.issues;
    const critical = issues.filter((issue) => issue.severity === 'critical');
    const isCritical = critical.length > 0;

    const Icon = isCritical ? ShieldAlert : AlertTriangle;

    return (
        <section
            role="alert"
            className={cn(
                'overflow-hidden rounded-lg border',
                isCritical
                    ? 'border-[var(--bc-border-danger)] bg-danger-subtle'
                    : 'border-[var(--bc-border-warning)] bg-warning-subtle',
            )}
        >
            <div className="flex items-start gap-3 px-5 py-4">
                <Icon
                    aria-hidden="true"
                    strokeWidth={1.5}
                    className={cn(
                        'mt-0.5 size-5 shrink-0',
                        isCritical ? 'text-fg-danger' : 'text-fg-warning',
                    )}
                />

                <div className="min-w-0 flex-1">
                    <p
                        className={cn(
                            'text-overline font-mono',
                            isCritical ? 'text-fg-danger' : 'text-fg-warning',
                        )}
                    >
                        beacon <span className="opacity-50">//</span>{' '}
                        {isCritical ? 'critical' : 'warning'}
                    </p>

                    <h2 className="mt-0.5 text-[16px] leading-6 font-semibold text-fg-strong">
                        {isCritical
                            ? 'This installation is degraded'
                            : 'Panel health warnings'}
                    </h2>

                    <ul className="mt-3 space-y-2">
                        {issues.map((issue) => (
                            <li
                                key={issue.message}
                                className="flex items-start gap-2.5"
                            >
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        'mt-[7px] size-1.5 shrink-0 rounded-full',
                                        issue.severity === 'critical'
                                            ? 'bg-[var(--bc-bg-danger)]'
                                            : 'bg-[var(--bc-bg-warning)]',
                                    )}
                                />
                                <span className="min-w-0 flex-1 text-[14px] leading-[22px] text-fg">
                                    <span className="text-overline me-2 font-mono text-fg-subtle">
                                        {issue.severity}
                                    </span>
                                    {issue.message}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </section>
    );
}
