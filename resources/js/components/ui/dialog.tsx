import { Slot } from '@radix-ui/react-slot';
import { XIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

type DialogContextValue = {
    open: boolean;
    setOpen: (open: boolean) => void;
};

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialog(): DialogContextValue {
    const context = React.useContext(DialogContext);

    if (!context) {
        throw new Error('Dialog components must be used within Dialog.');
    }

    return context;
}

function Dialog({
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
        <DialogContext.Provider value={{ open, setOpen }}>
            <div data-slot="dialog" {...props}>
                {children}
            </div>
        </DialogContext.Provider>
    );
}

function DialogTrigger({
    asChild = false,
    ...props
}: React.ComponentProps<'button'> & { asChild?: boolean }) {
    const { setOpen } = useDialog();
    const Comp = asChild ? Slot : 'button';

    return (
        <Comp
            data-slot="dialog-trigger"
            type={asChild ? undefined : 'button'}
            {...props}
            onClick={(event) => {
                props.onClick?.(event);
                setOpen(true);
            }}
        />
    );
}

function DialogClose({
    asChild = false,
    ...props
}: React.ComponentProps<'button'> & { asChild?: boolean }) {
    const { setOpen } = useDialog();
    const Comp = asChild ? Slot : 'button';

    return (
        <Comp
            data-slot="dialog-close"
            type={asChild ? undefined : 'button'}
            {...props}
            onClick={(event) => {
                props.onClick?.(event);
                setOpen(false);
            }}
        />
    );
}

function DialogPortal({ children }: { children: React.ReactNode }) {
    return children;
}

function DialogOverlay() {
    return null;
}

function DialogContent({
    className,
    innerClassName,
    children,
    showCloseButton = true,
    ...props
}: React.ComponentProps<'dialog'> & {
    showCloseButton?: boolean;
    innerClassName?: string;
}) {
    const { open, setOpen } = useDialog();
    const dialogRef = React.useRef<HTMLDialogElement>(null);

    React.useEffect(() => {
        const element = dialogRef.current;

        if (!element) {
            return;
        }

        if (open && !element.open) {
            element.showModal();
        }

        if (!open && element.open) {
            element.close();
        }
    }, [open]);

    return (
        <dialog
            ref={dialogRef}
            data-slot="dialog-content"
            className={cn('modal', open && 'modal-open')}
            onClose={() => setOpen(false)}
            {...props}
        >
            <div
                className={cn(
                    'modal-box max-h-[min(90vh,calc(100vh-2rem))] max-w-[calc(100%-2rem)] overflow-y-auto rounded-2xl border border-base-300 bg-base-100 p-0 text-base-content shadow-2xl sm:max-w-lg',
                    className,
                )}
            >
                {showCloseButton && (
                    <form method="dialog" className="absolute top-3 right-3 z-10">
                        <button
                            type="submit"
                            className="btn btn-sm btn-circle btn-ghost"
                            aria-label="Close"
                        >
                            <XIcon className="size-4" />
                        </button>
                    </form>
                )}

                <div className={cn('p-6 pt-7', innerClassName)}>{children}</div>
            </div>

            <form method="dialog" className="modal-backdrop">
                <button type="submit" className="sr-only">
                    Close
                </button>
            </form>
        </dialog>
    );
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="dialog-header"
            className={cn(
                'mb-4 flex flex-col gap-2 pr-8 text-center sm:text-left',
                className,
            )}
            {...props}
        />
    );
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="dialog-footer"
            className={cn(
                'modal-action mt-6 flex flex-col-reverse gap-2 p-0 sm:flex-row sm:justify-end',
                className,
            )}
            {...props}
        />
    );
}

function DialogTitle({ className, ...props }: React.ComponentProps<'h2'>) {
    return (
        <h2
            data-slot="dialog-title"
            className={cn(
                'text-lg leading-none font-semibold text-base-content',
                className,
            )}
            {...props}
        />
    );
}

function DialogDescription({
    className,
    ...props
}: React.ComponentProps<'p'>) {
    return (
        <p
            data-slot="dialog-description"
            className={cn('text-sm text-base-content/70', className)}
            {...props}
        />
    );
}

export {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogOverlay,
    DialogPortal,
    DialogTitle,
    DialogTrigger,
};
