import { AlertTriangle, HelpCircle } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogBody,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogSection,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

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
    const tone = destructive ? 'danger' : 'brand';

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

            <DialogContent size="sm">
                <DialogHeader
                    tone={tone}
                    eyebrow={destructive ? 'Destructive action' : 'Confirm'}
                    icon={
                        destructive ? (
                            <AlertTriangle />
                        ) : (
                            <HelpCircle />
                        )
                    }
                >
                    <DialogTitle>{title}</DialogTitle>
                    {description ? (
                        <DialogDescription>{description}</DialogDescription>
                    ) : null}
                </DialogHeader>

                <DialogBody className="space-y-4">
                    {destructive ? (
                        <DialogSection title="Before you continue">
                            <p className="text-sm text-base-content/80">
                                This cannot be undone. Make sure you really
                                want to proceed.
                            </p>
                        </DialogSection>
                    ) : null}

                    {children}

                    {requiresTypedConfirmation ? (
                        <DialogSection title="Type to confirm">
                            <p className="mb-3 text-sm text-base-content/70">
                                {confirmationLabel ?? (
                                    <>
                                        Enter{' '}
                                        <span className="font-semibold text-base-content">
                                            {confirmationValue}
                                        </span>{' '}
                                        exactly as shown.
                                    </>
                                )}
                            </p>
                            <Label
                                htmlFor="confirm-dialog-value"
                                className="sr-only"
                            >
                                Confirmation value
                            </Label>
                            <Input
                                id="confirm-dialog-value"
                                value={typedValue}
                                onChange={(event) =>
                                    setTypedValue(event.target.value)
                                }
                                autoComplete="off"
                                placeholder={confirmationValue}
                                mono
                            />
                        </DialogSection>
                    ) : null}
                </DialogBody>

                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="ghost">{cancelLabel}</Button>
                    </DialogClose>

                    <Button
                        variant={destructive ? 'destructive' : 'default'}
                        disabled={!canConfirm || processing}
                        onClick={onConfirm}
                    >
                        {processing ? <Spinner /> : null}
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
