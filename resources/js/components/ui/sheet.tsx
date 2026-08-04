import { Slot } from '@radix-ui/react-slot';
import { XIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

type SheetContextValue = {
    open: boolean;
    setOpen: (open: boolean) => void;
};

const SheetContext = React.createContext<SheetContextValue | null>(null);

function useSheet(): SheetContextValue {
    const context = React.useContext(SheetContext);

    if (!context) {
        throw new Error('Sheet components must be used within Sheet.');
    }

    return context;
}

function Sheet({
    open: openProp,
    defaultOpen = false,
    onOpenChange,
    children,
    ...props
}: React.ComponentProps<'div'> & {
    open?: boolean;
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
}) {
    const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
    const open = openProp ?? uncontrolledOpen;

    const setOpen = React.useCallback(
        (value: boolean) => {
            onOpenChange?.(value);

            if (openProp === undefined) {
                setUncontrolledOpen(value);
            }
        },
        [onOpenChange, openProp],
    );

    return (
        <SheetContext.Provider value={{ open, setOpen }}>
            <div data-slot="sheet" {...props}>
                {children}
            </div>
        </SheetContext.Provider>
    );
}

function SheetTrigger({
    asChild = false,
    ...props
}: React.ComponentProps<'button'> & { asChild?: boolean }) {
    const { setOpen } = useSheet();
    const Comp = asChild ? Slot : 'button';

    return (
        <Comp
            data-slot="sheet-trigger"
            type={asChild ? undefined : 'button'}
            {...props}
            onClick={(event) => {
                props.onClick?.(event);
                setOpen(true);
            }}
        />
    );
}

function SheetClose({
    asChild = false,
    ...props
}: React.ComponentProps<'button'> & { asChild?: boolean }) {
    const { setOpen } = useSheet();
    const Comp = asChild ? Slot : 'button';

    return (
        <Comp
            data-slot="sheet-close"
            type={asChild ? undefined : 'button'}
            {...props}
            onClick={(event) => {
                props.onClick?.(event);
                setOpen(false);
            }}
        />
    );
}

function SheetPortal({ children }: { children: React.ReactNode }) {
    return children;
}

function SheetOverlay({
    className,
    ...props
}: React.ComponentProps<'button'>) {
    const { setOpen } = useSheet();

    return (
        <button
            type="button"
            data-slot="sheet-overlay"
            aria-label="Close panel"
            className={cn('drawer-overlay', className)}
            onClick={() => setOpen(false)}
            {...props}
        />
    );
}

function SheetContent({
    className,
    children,
    side = 'right',
    ...props
}: React.ComponentProps<'div'> & {
    side?: 'top' | 'right' | 'bottom' | 'left';
}) {
    const { open, setOpen } = useSheet();

    if (!open) {
        return null;
    }

    return (
        <div className="fixed inset-0 z-50">
            <SheetOverlay />

            <div
                data-slot="sheet-content"
                className={cn(
                    'fixed z-50 flex flex-col gap-4 border-base-300 bg-base-100 p-6 text-base-content shadow-2xl',
                    side === 'right' &&
                        'inset-y-0 right-0 h-full w-[min(100vw-2rem,24rem)] rounded-l-2xl border-l',
                    side === 'left' &&
                        'inset-y-0 left-0 h-full w-[min(100vw-2rem,24rem)] rounded-r-2xl border-r',
                    side === 'top' &&
                        'inset-x-0 top-0 h-auto w-full rounded-b-2xl border-b',
                    side === 'bottom' &&
                        'inset-x-0 bottom-0 h-auto w-full rounded-t-2xl border-t',
                    className,
                )}
                {...props}
            >
                {children}
                <button
                    type="button"
                    className="btn btn-sm btn-circle btn-ghost absolute top-4 right-4"
                    onClick={() => setOpen(false)}
                    aria-label="Close"
                >
                    <XIcon className="size-4" />
                </button>
            </div>
        </div>
    );
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="sheet-header"
            className={cn('flex flex-col gap-1.5 pr-10', className)}
            {...props}
        />
    );
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="sheet-footer"
            className={cn('modal-action mt-auto flex flex-col gap-2 p-0', className)}
            {...props}
        />
    );
}

function SheetTitle({ className, ...props }: React.ComponentProps<'h2'>) {
    return (
        <h2
            data-slot="sheet-title"
            className={cn('text-lg font-semibold text-base-content', className)}
            {...props}
        />
    );
}

function SheetDescription({
    className,
    ...props
}: React.ComponentProps<'p'>) {
    return (
        <p
            data-slot="sheet-description"
            className={cn('text-sm text-base-content/70', className)}
            {...props}
        />
    );
}

export {
    Sheet,
    SheetTrigger,
    SheetClose,
    SheetContent,
    SheetHeader,
    SheetFooter,
    SheetTitle,
    SheetDescription,
    SheetPortal,
    SheetOverlay,
};
