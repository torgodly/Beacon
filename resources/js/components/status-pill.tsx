import type { LucideIcon } from 'lucide-react';
import {
    Clock,
    Hammer,
    Moon,
    Slash,
    Square,
    TriangleAlert,
    UploadCloud,
} from 'lucide-react';
import {
    StatusIndicator,
    type StatusIndicatorTone,
} from '@/components/status-indicator';
import { cn } from '@/lib/utils';

/**
 * Beacon Design System · Status system (PDF §02)
 *
 * The nine states of the deployment lifecycle. Never remapped per-screen —
 * status colours are learned muscle memory.
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
    className: string;
    indicator: StatusIndicatorTone | null;
    spin?: boolean;
};

const STATUS: Record<BeaconStatus, StatusSpec> = {
    queued: {
        label: 'Queued',
        icon: Clock,
        className:
            'border-[#DDD6FE] bg-[#F5F3FF] text-[#6D28D9] dark:border-[#5B21B6] dark:bg-[#2E1065]/50 dark:text-[#A78BFA]',
        indicator: 'progress',
    },
    building: {
        label: 'Building',
        icon: Hammer,
        className:
            'border-[#DDD6FE] bg-[#F5F3FF] text-[#6D28D9] dark:border-[#5B21B6] dark:bg-[#2E1065]/50 dark:text-[#A78BFA]',
        indicator: 'progress',
        spin: true,
    },
    deploying: {
        label: 'Deploying',
        icon: UploadCloud,
        className:
            'border-[#A5F2FB] bg-[#ECFDFF] text-[#0A788F] dark:border-[#106175] dark:bg-[#063543]/50 dark:text-[#22D0E8]',
        indicator: null,
    },
    live: {
        label: 'Live',
        icon: Square,
        className:
            'border-[#A6F4C5] bg-[#ECFDF3] text-[#15803D] dark:border-[#166534] dark:bg-[#052E16]/50 dark:text-[#4ADE80]',
        indicator: 'healthy',
    },
    degraded: {
        label: 'Degraded',
        icon: TriangleAlert,
        className:
            'border-[#FDE68A] bg-[#FFFBEB] text-[#B45309] dark:border-[#92400E] dark:bg-[#451A03]/50 dark:text-[#FBBF24]',
        indicator: 'warning',
    },
    failed: {
        label: 'Failed',
        icon: Square,
        className:
            'border-[#FECACA] bg-[#FEF2F2] text-[#B91C1C] dark:border-[#991B1B] dark:bg-[#450A0A]/50 dark:text-[#F87171]',
        indicator: 'failed',
    },
    stopped: {
        label: 'Stopped',
        icon: Square,
        className:
            'border-[var(--bc-border-default)] bg-[var(--bc-bg-neutral-subtle)] text-fg-muted',
        indicator: 'neutral',
    },
    sleeping: {
        label: 'Sleeping',
        icon: Moon,
        className:
            'border-[var(--bc-border-default)] bg-[var(--bc-bg-neutral-subtle)] text-fg-muted',
        indicator: 'neutral',
    },
    canceled: {
        label: 'Canceled',
        icon: Slash,
        className:
            'border-[var(--bc-border-default)] bg-[var(--bc-bg-neutral-subtle)] text-fg-muted',
        indicator: 'neutral',
    },
};

export function toStatus(raw: string | null | undefined): BeaconStatus {
    switch ((raw ?? '').toLowerCase()) {
        case 'queued':
        case 'pending':
        case 'installing':
        case 'provisioning':
        case 'starting':
            return 'queued';

        case 'building':
        case 'running':
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
            {spec.indicator ? (
                <StatusIndicator tone={spec.indicator} size="sm" />
            ) : (
                <Icon
                    aria-hidden="true"
                    strokeWidth={1.5}
                    className={cn(
                        'size-3.5 shrink-0',
                        spec.spin && 'animate-spin',
                    )}
                />
            )}
            <span>{label ?? spec.label}</span>
        </span>
    );
}
