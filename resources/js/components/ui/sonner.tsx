import { useFlashToast } from '@/hooks/use-flash-toast';
import { useAppearance } from '@/hooks/use-appearance';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

function Toaster({ ...props }: ToasterProps) {
    const { resolvedAppearance } = useAppearance();

    useFlashToast();

    return (
        <Sonner
            theme={resolvedAppearance}
            className="toaster group"
            position="top-right"
            richColors
            closeButton
            visibleToasts={4}
            duration={4500}
            offset={{
                top: 'calc(var(--bc-topbar-height) + 16px)',
                right: '16px',
            }}
            toastOptions={{
                classNames: {
                    toast: 'bc-toast',
                    title: 'text-body-md font-medium',
                    description: 'text-body-sm opacity-90',
                },
            }}
            {...props}
        />
    );
}

export { Toaster };
