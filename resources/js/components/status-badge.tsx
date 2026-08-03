import type { BeaconStatus } from '@/components/status-pill';
import { StatusPill, toStatus } from '@/components/status-pill';

/**
 * Compatibility shim over {@link StatusPill}.
 *
 * The original component hardcoded raw Tailwind palette classes
 * (`bg-green-100 text-green-700 dark:bg-green-500/15`), which meant status
 * colour was duplicated per component, unthemeable, and free to drift from
 * the chart palette. Everything now resolves through the design system's
 * nine canonical states.
 *
 * Prefer importing StatusPill directly in new code.
 */
export type Status =
    | 'success'
    | 'running'
    | 'failed'
    | 'pending'
    | 'warning'
    | 'stopped'
    | 'info';

const LEGACY: Record<Status, BeaconStatus> = {
    success: 'live',
    running: 'building',
    failed: 'failed',
    pending: 'queued',
    warning: 'degraded',
    stopped: 'stopped',
    info: 'deploying',
};

export function StatusBadge({
    status,
    label,
    className,
}: {
    status: Status;
    label?: string;
    className?: string;
}) {
    return (
        <StatusPill
            status={LEGACY[status] ?? toStatus(status)}
            label={label}
            className={className}
        />
    );
}
