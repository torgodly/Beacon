import type { LucideIcon } from 'lucide-react';
import {
    CircleDot,
    CircleX,
    Clock,
    Hammer,
    Moon,
    Slash,
    Square,
    TriangleAlert,
    UploadCloud,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Beacon Design System · Status system (PDF §02)
 *
 * The nine states of the deployment lifecycle. Never remapped per-screen —
 * status colours are learned muscle memory.
 *
 * Colour is the THIRD signal. Every pill renders icon + label + colour, in
 * that order of reliability, so the whole system survives a greyscale
 * screenshot and colour-blind vision. That is the practical test.
 */
export type BeaconStatus =
    | 'queued'
    | 'building'
    | 'deploying'
    | 'live'
    | 'degraded'
    | 'failed'
    | 'stopped'
    | 'sleeping'
    | 'canceled';

type StatusSpec = {
    label: string;
    icon: LucideIcon;
    /** Foreground + subtle background, both from the semantic layer. */
    className: string;
    /** Slow breathing opacity — only the live indicator gets this. */
    pulse?: boolean;
    /** Continuous rotation for genuinely in-flight work. */
    spin?: boolean;
};

const STATUS: Record<BeaconStatus, StatusSpec> = {
    queued: {
        label: 'Queued',
        icon: Clock,
        className:
            'text-fg-muted bg-[var(--bc-bg-neutral-subtle)] border-[var(--bc-border-default)]',
    },
    building: {
        label: 'Building',
        icon: Hammer,
        className:
            'text-fg-progress bg-progress-subtle border-[var(--bc-bg-progress)]/30',
    },
    deploying: {
        label: 'Deploying',
        icon: UploadCloud,
        className:
            'text-fg-brand bg-brand-subtle border-[var(--bc-border-brand)]/30',
        spin: false,
    },
    live: {
        label: 'Live',
        icon: CircleDot,
        className:
            'text-fg-success bg-success-subtle border-[var(--bc-border-success)]/30',
        pulse: true,
    },
    degraded: {
        label: 'Degraded',
        icon: TriangleAlert,
        className:
            'text-fg-warning bg-warning-subtle border-[var(--bc-border-warning)]/30',
    },
    failed: {
        label: 'Failed',
        icon: CircleX,
        className:
            'text-fg-danger bg-danger-subtle border-[var(--bc-border-danger)]/30',
    },
    stopped: {
        label: 'Stopped',
        icon: Square,
        className:
            'text-fg-subtle bg-[var(--bc-bg-neutral-subtle)] border-[var(--bc-border-default)]',
    },
    sleeping: {
        label: 'Sleeping',
        icon: Moon,
        className:
            'text-fg-subtle bg-[var(--bc-bg-neutral-subtle)] border-[var(--bc-border-default)]',
    },
    canceled: {
        label: 'Canceled',
        icon: Slash,
        className:
            'text-fg-subtle bg-[var(--bc-bg-neutral-subtle)] border-[var(--bc-border-default)]',
    },
};

/**
 * Maps Beacon's many domain vocabularies onto the nine canonical states.
 *
 * Deployments, Supervisor programs, systemd units, SSL certificates and PHP
 * installs all report differently worded statuses; without one funnel every
 * screen invents its own colour mapping, which is exactly the decay the
 * design system exists to prevent.
 */
export function toStatus(raw: string | null | undefined): BeaconStatus {
    switch ((raw ?? '').toLowerCase()) {
        case 'queued':
        case 'pending':
        case 'installing':
        case 'provisioning':
        case 'starting':
            return 'queued';

        case 'building':
        case 'running': // a running *deployment* is work in progress
            return 'building';

        case 'deploying':
            return 'deploying';

        case 'live':
        case 'active':
        case 'success':
        case 'succeeded':
        case 'issued':
        case 'installed':
        case 'healthy':
            return 'live';

        case 'degraded':
        case 'warning':
        case 'expiring':
            return 'degraded';

        case 'failed':
        case 'fatal':
        case 'error':
        case 'timed_out':
        case 'expired':
            return 'failed';

        case 'stopped':
        case 'exited':
        case 'inactive':
        case 'disabled':
            return 'stopped';

        case 'sleeping':
        case 'idle':
            return 'sleeping';

        case 'canceled':
        case 'cancelled':
        case 'revoked':
            return 'canceled';

        default:
            return 'stopped';
    }
}

export function StatusPill({
    status,
    label,
    size = 'md',
    className,
}: {
    status: BeaconStatus;
    /** Overrides the canonical label. The colour never changes. */
    label?: string;
    size?: 'sm' | 'md';
    className?: string;
}) {
    const spec = STATUS[status];
    const Icon = spec.icon;

    return (
        <span
            data-slot="status-pill"
            data-status={status}
            className={cn(
                'inline-flex items-center gap-1.5 rounded-sm border font-medium',
                size === 'sm'
                    ? 'px-1.5 py-0.5 text-[12px] leading-[18px]'
                    : 'px-2 py-0.5 text-[13px] leading-[18px]',
                spec.className,
                className,
            )}
        >
            <Icon
                aria-hidden="true"
                strokeWidth={1.5}
                className={cn(
                    'size-3.5 shrink-0',
                    spec.pulse && 'bc-live-dot',
                    spec.spin && 'animate-spin',
                )}
            />
            {/* Real text in the DOM — never a ::before or a background image,
             * so screen readers and greyscale screenshots both work. */}
            <span>{label ?? spec.label}</span>
        </span>
    );
}
