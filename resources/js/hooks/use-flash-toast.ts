import { router } from '@inertiajs/react';
import type { Page } from '@inertiajs/core';
import { useEffect, useRef } from 'react';
import { toast } from '@/lib/toast';
import type { FlashToast } from '@/types/ui';

function showFlashToast(data: FlashToast | undefined | null): void {
    if (!data?.message) {
        return;
    }

    toast[data.type](data.message);
}

type FlashProps = {
    flash?: {
        toast?: FlashToast | null;
    };
};

function readSessionToast(page: Page | undefined): FlashToast | null | undefined {
    const props = page?.props as FlashProps | undefined;

    return props?.flash?.toast;
}

function readInertiaFlash(flash: unknown): FlashToast | null | undefined {
    if (!flash || typeof flash !== 'object') {
        return undefined;
    }

    return (flash as { toast?: FlashToast }).toast;
}

export function useFlashToast(): void {
    const lastShown = useRef<string | null>(null);

    useEffect(() => {
        function present(data: FlashToast | undefined | null): void {
            if (!data?.message) {
                return;
            }

            const key = `${data.type}:${data.message}`;

            if (lastShown.current === key) {
                return;
            }

            lastShown.current = key;
            showFlashToast(data);
        }

        const root = document.getElementById('app');

        if (root?.dataset.page) {
            try {
                const page = JSON.parse(root.dataset.page) as Page;
                present(readSessionToast(page));
            } catch {
                // Ignore malformed bootstrap payload.
            }
        }

        const unsubFlash = router.on('flash', (event) => {
            present(readInertiaFlash(event.detail.flash));
        });

        const unsubSuccess = router.on('success', (event) => {
            present(readSessionToast(event.detail.page));
        });

        const unsubNavigate = router.on('navigate', (event) => {
            present(readSessionToast(event.detail.page));
        });

        return () => {
            unsubFlash();
            unsubSuccess();
            unsubNavigate();
        };
    }, []);
}
