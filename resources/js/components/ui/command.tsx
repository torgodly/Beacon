import { Command as CommandPrimitive } from 'cmdk';
import { SearchIcon } from 'lucide-react';
import * as React from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

function Command({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive>) {
    return (
        <CommandPrimitive
            data-slot="command"
            className={cn(
                'flex h-full w-full flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground',
                className,
            )}
            {...props}
        />
    );
}

function CommandDialog({
    title = 'Command palette',
    description = 'Search for a page or action',
    children,
    className,
    ...props
}: React.ComponentProps<typeof Dialog> & {
    title?: string;
    description?: string;
    className?: string;
}) {
    return (
        <Dialog {...props}>
            <DialogContent
                className={cn(
                    'overflow-hidden p-0 shadow-2xl sm:max-w-xl [&>button]:hidden',
                    className,
                )}
            >
                <DialogTitle className="sr-only">{title}</DialogTitle>
                <p className="sr-only">{description}</p>
                <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:size-4 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-2.5 [&_[cmdk-item]_svg]:size-4">
                    {children}
                </Command>
            </DialogContent>
        </Dialog>
    );
}

function CommandInput({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
    return (
        <div
            className="flex items-center border-b px-3"
            cmdk-input-wrapper=""
        >
            <SearchIcon className="mr-2 size-4 shrink-0 opacity-50" />
            <CommandPrimitive.Input
                data-slot="command-input"
                className={cn(
                    'flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
                    className,
                )}
                {...props}
            />
        </div>
    );
}

function CommandList({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
    return (
        <CommandPrimitive.List
            data-slot="command-list"
            className={cn(
                'max-h-[min(420px,50vh)] overflow-x-hidden overflow-y-auto',
                className,
            )}
            {...props}
        />
    );
}

function CommandEmpty({
    ...props
}: React.ComponentProps<typeof CommandPrimitive.Empty>) {
    return (
        <CommandPrimitive.Empty
            data-slot="command-empty"
            className="py-6 text-center text-sm text-muted-foreground"
            {...props}
        />
    );
}

function CommandGroup({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
    return (
        <CommandPrimitive.Group
            data-slot="command-group"
            className={cn(
                'overflow-hidden p-1 text-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5',
                className,
            )}
            {...props}
        />
    );
}

function CommandSeparator({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
    return (
        <CommandPrimitive.Separator
            data-slot="command-separator"
            className={cn('-mx-1 h-px bg-border', className)}
            {...props}
        />
    );
}

function CommandItem({
    className,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
    return (
        <CommandPrimitive.Item
            data-slot="command-item"
            className={cn(
                'relative flex cursor-default items-center gap-2 rounded-md px-2 py-2 text-sm outline-none select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0',
                className,
            )}
            {...props}
        />
    );
}

function CommandShortcut({
    className,
    ...props
}: React.ComponentProps<'span'>) {
    return (
        <span
            data-slot="command-shortcut"
            className={cn(
                'ml-auto text-xs tracking-widest text-muted-foreground',
                className,
            )}
            {...props}
        />
    );
}

export {
    Command,
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
};
