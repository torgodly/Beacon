import { Slot } from '@radix-ui/react-slot';
import { XIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

type DialogContextValue = {
    open: boolean;
    setOpen: (open: boolean) => void;
};

type DialogTone = 'default' | 'brand' | 'danger' | 'success';
type DialogSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

const DialogContext = React.createContext<DialogContextValue | null>(null);

const sizeClasses: Record<DialogSize, string> = {
    sm: 'sm:max-w-md',
    md: 'sm:max-w-lg',
    lg: 'sm:max-w-2xl',
    xl: 'sm:max-w-4xl',
    full: 'sm:max-w-[min(96vw,64rem)]',
};

const toneStyles: Record<
    DialogTone,
    { header: string; icon: string; stripe: string }
> = {
    default: {
        header: 'from-base-200/70 via-base-100 to-base-100',
        icon: 'bg-base-200 text-base-content',
        stripe: 'bg-base-300',
    },
    brand: {
        header: 'from-primary/12 via-base-100 to-base-100',
        icon: 'bg-primary/15 text-primary',
        stripe: 'bg-primary',
    },
    danger: {
        header: 'from-error/10 via-base-100 to-base-100',
        icon: 'bg-error/15 text-error',
        stripe: 'bg-error',
    },
    success: {
        header: 'from-success/10 via-base-100 to-base-100',
        icon: 'bg-success/15 text-success',
        stripe: 'bg-success',
    },
};

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
    children,
    showCloseButton = true,
    size = 'md',
    ...props
}: React.ComponentProps<'dialog'> & {
    showCloseButton?: boolean;
    size?: DialogSize;
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

    const close = React.useCallback(() => {
        setOpen(false);
    }, [setOpen]);

    return (
        <dialog
            ref={dialogRef}
            data-slot="dialog-content"
            className={cn('modal', open && 'modal-open')}
            onClose={close}
            onCancel={(event) => {
                event.preventDefault();
                close();
            }}
            {...props}
        >
            <div
                className={cn(
                    'modal-box relative z-0 flex max-h-[min(92vh,calc(100vh-1.5rem))] max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-2xl border border-base-300 bg-base-100 p-0 text-base-content shadow-2xl',
                    sizeClasses[size],
                    className,
                )}
            >
                {showCloseButton && (
                    <button
                        type="button"
                        onClick={close}
                        className="btn btn-sm btn-circle btn-ghost absolute top-4 right-4 z-20 bg-base-100/80 hover:bg-base-200"
                        aria-label="Close"
                    >
                        <XIcon className="size-4" />
                    </button>
                )}

                <div className="flex min-h-0 flex-1 flex-col">{children}</div>
            </div>

            <div className="modal-backdrop">
                <button
                    type="button"
                    tabIndex={-1}
                    className="size-full min-h-full cursor-default border-0 bg-transparent p-0"
                    aria-label="Close dialog"
                    onClick={close}
                />
            </div>
        </dialog>
    );
}

function DialogHeader({
    className,
    icon,
    tone = 'brand',
    eyebrow,
    align = 'start',
    children,
    ...props
}: React.ComponentProps<'div'> & {
    icon?: React.ReactNode;
    tone?: DialogTone;
    eyebrow?: string;
    align?: 'start' | 'center';
}) {
    const styles = toneStyles[tone];
    const centered = align === 'center';

    return (
        <div
            data-slot="dialog-header"
            className={cn(
                'relative shrink-0 border-b border-base-300/80 bg-gradient-to-br px-6 pt-6 pr-14 pb-5',
                styles.header,
                centered && 'text-center',
                className,
            )}
            {...props}
        >
            {!centered && (
                <div
                    className={cn(
                        'absolute top-5 bottom-5 left-0 w-1 rounded-r-full',
                        styles.stripe,
                    )}
                />
            )}

            <div
                className={cn(
                    'flex gap-4',
                    centered && 'flex-col items-center',
                )}
            >
                {icon ? (
                    <div
                        className={cn(
                            'flex size-11 shrink-0 items-center justify-center rounded-2xl shadow-sm [&_svg]:size-5',
                            styles.icon,
                        )}
                    >
                        {icon}
                    </div>
                ) : null}

                <div
                    className={cn(
                        'min-w-0 flex-1 space-y-1.5',
                        centered && 'flex flex-col items-center',
                    )}
                >
                    {eyebrow ? (
                        <p className="text-overline text-base-content/50">
                            {eyebrow}
                        </p>
                    ) : null}
                    {children}
                </div>
            </div>
        </div>
    );
}

function DialogBody({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="dialog-body"
            className={cn(
                'min-h-0 flex-1 overflow-y-auto px-6 py-5',
                className,
            )}
            {...props}
        />
    );
}

function DialogSection({
    className,
    title,
    description,
    children,
    ...props
}: React.ComponentProps<'div'> & {
    title?: string;
    description?: string;
}) {
    return (
        <section
            className={cn(
                'rounded-xl border border-base-300 bg-base-200/30 p-4',
                className,
            )}
            {...props}
        >
            {(title || description) && (
                <div className="mb-3 space-y-1">
                    {title ? (
                        <h3 className="text-sm font-semibold text-base-content">
                            {title}
                        </h3>
                    ) : null}
                    {description ? (
                        <p className="text-sm text-base-content/70">
                            {description}
                        </p>
                    ) : null}
                </div>
            )}
            {children}
        </section>
    );
}

function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="dialog-footer"
            className={cn(
                'flex shrink-0 flex-col-reverse gap-2 border-t border-base-300/80 bg-base-200/50 px-6 py-4 sm:flex-row sm:items-center sm:justify-end',
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
                'text-lg leading-tight font-semibold tracking-tight text-base-content',
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
            className={cn(
                'max-w-prose text-sm leading-relaxed text-base-content/70',
                className,
            )}
            {...props}
        />
    );
}

export {
    Dialog,
    DialogBody,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogOverlay,
    DialogPortal,
    DialogSection,
    DialogTitle,
    DialogTrigger,
};
export type { DialogSize, DialogTone };
