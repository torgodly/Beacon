import type { FlashToast } from '@/types/ui';

type ToastHandler = (type: FlashToast['type'], message: string) => void;

let handler: ToastHandler | null = null;

export function registerToastHandler(fn: ToastHandler | null): void {
    handler = fn;
}

export const toast = {
    success(message: string): void {
        handler?.('success', message);
    },
    info(message: string): void {
        handler?.('info', message);
    },
    warning(message: string): void {
        handler?.('warning', message);
    },
    error(message: string): void {
        handler?.('error', message);
    },
};
