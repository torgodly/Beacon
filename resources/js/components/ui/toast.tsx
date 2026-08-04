import { useCallback, useEffect, useState } from 'react';
import { useFlashToast } from '@/hooks/use-flash-toast';
import { registerToastHandler } from '@/lib/toast';
import { cn } from '@/lib/utils';
import type { FlashToast } from '@/types/ui';

type ToastItem = {
    id: number;
    type: FlashToast['type'];
    message: string;
};

const alertClass: Record<FlashToast['type'], string> = {
    success: 'alert-success',
    info: 'alert-info',
    warning: 'alert-warning',
    error: 'alert-error',
};

function Toaster() {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const push = useCallback((type: FlashToast['type'], message: string) => {
        const id = Date.now() + Math.random();

        setToasts((current) => [...current, { id, type, message }]);

        window.setTimeout(() => {
            setToasts((current) => current.filter((toast) => toast.id !== id));
        }, 4500);
    }, []);

    useEffect(() => {
        registerToastHandler(push);

        return () => registerToastHandler(null);
    }, [push]);

    useFlashToast();

    return (
        <div className="toast toast-top toast-end z-[9999] w-full max-w-sm">
            {toasts.map((item) => (
                <div
                    key={item.id}
                    className={cn('alert shadow-lg', alertClass[item.type])}
                    role="alert"
                >
                    <span>{item.message}</span>
                    <button
                        type="button"
                        className="btn btn-sm btn-circle btn-ghost"
                        aria-label="Dismiss notification"
                        onClick={() =>
                            setToasts((current) =>
                                current.filter((toast) => toast.id !== item.id),
                            )
                        }
                    >
                        ✕
                    </button>
                </div>
            ))}
        </div>
    );
}

export { Toaster };
