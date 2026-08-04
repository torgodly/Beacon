import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

export type ConfirmDialogProps = {
    /** Element that opens the dialog, e.g. a `<Button>`. */
    trigger: ReactNode;
    title: string;
    description?: ReactNode;
    /** Extra content rendered between the description and the footer. */
    children?: ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    /** Style the confirm button as destructive (e.g. delete actions). */
    destructive?: boolean;
    /** Disables the confirm button and shows a spinner while true. */
    processing?: boolean;
    /**
     * When set, the user must type this exact value before the confirm
     * button becomes enabled. Useful for destructive actions such as
     * deleting a site, where typing the site name confirms intent.
     */
    confirmationValue?: string;
    confirmationLabel?: ReactNode;
    onConfirm: () => void;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
};

export function ConfirmDialog({
    trigger,
    title,
    description,
    children,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    destructive = false,
    processing = false,
    confirmationValue,
    confirmationLabel,
    onConfirm,
    open,
    onOpenChange,
}: ConfirmDialogProps) {
    const [typedValue, setTypedValue] = useState('');
    const requiresTypedConfirmation = confirmationValue !== undefined;
    const canConfirm = requiresTypedConfirmation
        ? typedValue === confirmationValue
        : true;

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) {
                    setTypedValue('');
                }

                onOpenChange?.(next);
            }}
        >
            <DialogTrigger asChild>{trigger}</DialogTrigger>

            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {description && (
                        <DialogDescription>{description}</DialogDescription>
                    )}
                </DialogHeader>

                {destructive && (
                    <div className="alert alert-warning rounded-xl text-sm">
                        <span>This action cannot be undone.</span>
                    </div>
                )}

                {children}

                {requiresTypedConfirmation && (
                    <div className="form-control mt-4 w-full gap-2">
                        <Label htmlFor="confirm-dialog-value">
                            {confirmationLabel ?? (
                                <>
                                    Type{' '}
                                    <span className="font-semibold">
                                        {confirmationValue}
                                    </span>{' '}
                                    to confirm
                                </>
                            )}
                        </Label>
                        <Input
                            id="confirm-dialog-value"
                            value={typedValue}
                            onChange={(event) =>
                                setTypedValue(event.target.value)
                            }
                            autoComplete="off"
                        />
                    </div>
                )}

                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="ghost">{cancelLabel}</Button>
                    </DialogClose>

                    <Button
                        variant={destructive ? 'destructive' : 'default'}
                        className={cn(destructive && 'btn-error')}
                        disabled={!canConfirm || processing}
                        onClick={onConfirm}
                    >
                        {processing && <Spinner />}
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
