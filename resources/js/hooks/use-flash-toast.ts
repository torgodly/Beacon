import { router, usePage } from '@inertiajs/react';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { FlashToast } from '@/types/ui';

function showFlashToast(data: FlashToast | undefined | null): void {
    if (!data?.message) {
        return;
    }

    toast[data.type](data.message);
}

export function useFlashToast(): void {
    const { flash } = usePage<{ flash?: { toast?: FlashToast | null } }>().props;
    const lastShown = useRef<string | null>(null);

    useEffect(() => {
        const data = flash?.toast;

        if (!data) {
            return;
        }

        const key = `${data.type}:${data.message}`;

        if (lastShown.current === key) {
            return;
        }

        lastShown.current = key;
        showFlashToast(data);
    }, [flash?.toast]);

    useEffect(() => {
        return router.on('flash', (event) => {
            const flashData = (event as CustomEvent).detail?.flash;
            showFlashToast(flashData?.toast as FlashToast | undefined);
        });
    }, []);
}
