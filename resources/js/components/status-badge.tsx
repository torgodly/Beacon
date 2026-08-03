import type { LucideIcon } from 'lucide-react';
import {
    AlertTriangle,
    CheckCircle2,
    CircleDashed,
    CircleSlash,
    Loader2,
    XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type Status =
    | 'success'
    | 'running'
    | 'failed'
    | 'pending'
    | 'warning'
    | 'stopped'
    | 'info';

const statusConfig: Record<
    Status,
    { label: string; icon: LucideIcon; className: string; spin?: boolean }
> = {
    success: {
        label: 'Success',
        icon: CheckCircle2,
        className:
            'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400',
    },
    running: {
        label: 'Running',
        icon: Loader2,
        className:
            'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400',
        spin: true,
    },
    failed: {
        label: 'Failed',
        icon: XCircle,
        className:
            'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400',
    },
    pending: {
        label: 'Pending',
        icon: CircleDashed,
        className:
            'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    },
    warning: {
        label: 'Warning',
        icon: AlertTriangle,
        className:
            'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
    },
    stopped: {
        label: 'Stopped',
        icon: CircleSlash,
        className: 'bg-muted text-muted-foreground',
    },
    info: {
        label: 'Info',
        icon: CircleDashed,
        className:
            'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400',
    },
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
    const config = statusConfig[status];
    const Icon = config.icon;

    return (
        <Badge
            className={cn('border-transparent', config.className, className)}
        >
            <Icon className={cn('size-3', config.spin && 'animate-spin')} />
            {label ?? config.label}
        </Badge>
    );
}
