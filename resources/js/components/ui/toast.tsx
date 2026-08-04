import {
    AlertTriangle,
    CheckCircle2,
    Info,
    X,
    XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useFlashToast } from '@/hooks/use-flash-toast';
import { registerToastHandler } from '@/lib/toast';
import { cn } from '@/lib/utils';
import type { FlashToast } from '@/types/ui';

const AUTO_DISMISS_MS = 5200;
const EXIT_MS = 180;

type ToastItem = {
    id: number;
    type: FlashToast['type'];
    message: string;
    exiting: boolean;
};

type ToastTone = FlashToast['type'];

const toneConfig: Record<
    ToastTone,
    {
        label: string;
        stripe: string;
        surface: string;
        iconWrap: string;
        icon: typeof CheckCircle2;
        progress: string;
    }
> = {
    success: {
        label: 'Success',
        stripe: 'bg-[var(--bc-bg-success)]',
        surface:
            'border-[var(--bc-border-success)]/35 bg-success-subtle/90 backdrop-blur-sm',
        iconWrap: 'bg-[var(--bc-bg-success)]/15 text-fg-success',
        icon: CheckCircle2,
        progress: 'bg-[var(--bc-bg-success)]',
    },
    error: {
        label: 'Error',
        stripe: 'bg-[var(--bc-bg-danger)]',
        surface:
            'border-[var(--bc-border-danger)]/35 bg-danger-subtle/90 backdrop-blur-sm',
        iconWrap: 'bg-[var(--bc-bg-danger)]/15 text-fg-danger',
        icon: XCircle,
        progress: 'bg-[var(--bc-bg-danger)]',
    },
    warning: {
        label: 'Warning',
        stripe: 'bg-[var(--bc-bg-warning)]',
        surface:
            'border-[var(--bc-border-warning)]/35 bg-warning-subtle/90 backdrop-blur-sm',
        iconWrap: 'bg-[var(--bc-bg-warning)]/15 text-fg-warning',
        icon: AlertTriangle,
        progress: 'bg-[var(--bc-bg-warning)]',
    },
    info: {
        label: 'Notice',
        stripe: 'bg-primary',
        surface:
            'border-[var(--bc-border-brand)]/35 bg-brand-subtle/90 backdrop-blur-sm',
        iconWrap: 'bg-primary/15 text-fg-brand',
        icon: Info,
        progress: 'bg-primary',
    },
};

function ToastCard({
    item,
    onDismiss,
}: {
    item: ToastItem;
    onDismiss: (id: number) => void;
}) {
    const tone = toneConfig[item.type];
    const Icon = tone.icon;

    return (
        <div
            role="alert"
            aria-live="polite"
            className={cn(
                'bc-toast pointer-events-auto relative overflow-hidden rounded-xl border shadow-lg',
                tone.surface,
                item.exiting ? 'bc-toast-exit' : 'bc-toast-enter',
            )}
        >
            <div
                aria-hidden="true"
                className={cn(
                    'absolute top-3 bottom-3 left-0 w-1 rounded-r-full',
                    tone.stripe,
                )}
            />

            <div className="flex items-start gap-3 py-3.5 pr-3 pl-4">
                <div
                    className={cn(
                        'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg',
                        tone.iconWrap,
                    )}
                >
                    <Icon aria-hidden="true" className="size-4" strokeWidth={2} />
                </div>

                <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-overline font-mono text-fg-subtle">
                        {tone.label}
                    </p>
                    <p className="mt-0.5 text-sm leading-snug text-fg-strong">
                        {item.message}
                    </p>
                </div>

                <button
                    type="button"
                    aria-label="Dismiss notification"
                    onClick={() => onDismiss(item.id)}
                    className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-[var(--bc-bg-hover)] hover:text-fg-strong"
                >
                    <X aria-hidden="true" className="size-3.5" />
                </button>
            </div>

            {!item.exiting ? (
                <div
                    aria-hidden="true"
                    className={cn('bc-toast-progress h-0.5', tone.progress)}
                    style={{ animationDuration: `${AUTO_DISMISS_MS}ms` }}
                />
            ) : null}
        </div>
    );
}

function Toaster() {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const timers = useRef<Map<number, number>>(new Map());

    const dismiss = useCallback((id: number) => {
        const timer = timers.current.get(id);

        if (timer !== undefined) {
            window.clearTimeout(timer);
            timers.current.delete(id);
        }

        setToasts((current) =>
            current.map((toast) =>
                toast.id === id ? { ...toast, exiting: true } : toast,
            ),
        );

        window.setTimeout(() => {
            setToasts((current) => current.filter((toast) => toast.id !== id));
        }, EXIT_MS);
    }, []);

    const push = useCallback(
        (type: FlashToast['type'], message: string) => {
            const id = Date.now() + Math.random();

            setToasts((current) => [...current, { id, type, message, exiting: false }]);

            const timer = window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
            timers.current.set(id, timer);
        },
        [dismiss],
    );

    useEffect(() => {
        registerToastHandler(push);

        return () => {
            registerToastHandler(null);
            timers.current.forEach((timer) => window.clearTimeout(timer));
            timers.current.clear();
        };
    }, [push]);

    useFlashToast();

    if (toasts.length === 0) {
        return null;
    }

    return (
        <div
            aria-label="Notifications"
            className="pointer-events-none fixed top-4 right-4 z-[9999] flex w-[min(100vw-2rem,22rem)] flex-col gap-2.5"
        >
            {toasts.map((item) => (
                <ToastCard key={item.id} item={item} onDismiss={dismiss} />
            ))}
        </div>
    );
}

export { Toaster };
