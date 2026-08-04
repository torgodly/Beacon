import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu"
import { CheckIcon, ChevronRightIcon, CircleIcon } from "lucide-react"
import * as React from "react"

import { cn } from "@/lib/utils"

function DropdownMenu({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
  return <DropdownMenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuPortal({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Portal>) {
  return (
    <DropdownMenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
  )
}

function DropdownMenuTrigger({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Trigger>) {
  return (
    <DropdownMenuPrimitive.Trigger
      data-slot="dropdown-menu-trigger"
      {...props}
    />
  )
}

function DropdownMenuContent({
  className,
  sideOffset = 4,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-44 rounded-2xl border border-base-300 bg-base-100 p-2 text-base-content shadow-lg data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
          className
        )}
        {...props}
      >
        <ul className="menu menu-sm w-full rounded-xl p-0">{children}</ul>
      </DropdownMenuPrimitive.Content>
    </DropdownMenuPrimitive.Portal>
  )
}

function DropdownMenuGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Group>) {
  return (
    <DropdownMenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
  )
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  asChild = false,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Item> & {
  inset?: boolean
  variant?: "default" | "destructive"
  asChild?: boolean
}) {
  const itemClassName = cn(
    "rounded-xl focus:bg-base-200 data-[variant=destructive]:text-error data-[variant=destructive]:focus:bg-error/10 data-[variant=destructive]:focus:text-error data-[variant=destructive]:*:[svg]:!text-error [&_svg:not([class*='size-'])]:size-4 [&_svg:not([class*='text-'])]:text-base-content/60 [&_svg]:pointer-events-none [&_svg]:shrink-0",
    className
  )

  if (asChild && React.isValidElement(children)) {
    return (
      <li data-inset={inset} data-variant={variant}>
        <DropdownMenuPrimitive.Item
          data-slot="dropdown-menu-item"
          asChild
          {...props}
        >
          {React.cloneElement(children, {
            className: cn(itemClassName, children.props.className),
          } as React.HTMLAttributes<HTMLElement>)}
        </DropdownMenuPrimitive.Item>
      </li>
    )
  }

  return (
    <li data-inset={inset} data-variant={variant}>
      <DropdownMenuPrimitive.Item
        data-slot="dropdown-menu-item"
        className={cn(
          "relative flex cursor-default items-center gap-2 rounded-xl px-2 py-2 text-sm outline-hidden select-none focus:bg-base-200 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8",
          itemClassName
        )}
        {...props}
      >
        {children}
      </DropdownMenuPrimitive.Item>
    </li>
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <li>
      <DropdownMenuPrimitive.CheckboxItem
        data-slot="dropdown-menu-checkbox-item"
        className={cn(
          "relative flex cursor-default items-center gap-2 rounded-xl py-2 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-base-200 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
          className
        )}
        checked={checked}
        {...props}
      >
        <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
          <DropdownMenuPrimitive.ItemIndicator>
            <CheckIcon className="size-4" />
          </DropdownMenuPrimitive.ItemIndicator>
        </span>
        {children}
      </DropdownMenuPrimitive.CheckboxItem>
    </li>
  )
}

function DropdownMenuRadioGroup({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioGroup>) {
  return (
    <DropdownMenuPrimitive.RadioGroup
      data-slot="dropdown-menu-radio-group"
      {...props}
    />
  )
}

function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <li>
      <DropdownMenuPrimitive.RadioItem
        data-slot="dropdown-menu-radio-item"
        className={cn(
          "relative flex cursor-default items-center gap-2 rounded-xl py-2 pr-2 pl-8 text-sm outline-hidden select-none focus:bg-base-200 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
          className
        )}
        {...props}
      >
        <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
          <DropdownMenuPrimitive.ItemIndicator>
            <CircleIcon className="size-2 fill-current" />
          </DropdownMenuPrimitive.ItemIndicator>
        </span>
        {children}
      </DropdownMenuPrimitive.RadioItem>
    </li>
  )
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Label> & {
  inset?: boolean
}) {
  return (
    <li className="menu-title px-2 py-1">
      <DropdownMenuPrimitive.Label
        data-slot="dropdown-menu-label"
        data-inset={inset}
        className={cn(
          "text-sm font-medium text-base-content/70 data-[inset]:pl-8",
          className
        )}
        {...props}
      />
    </li>
  )
}

function DropdownMenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <li className="my-1">
      <DropdownMenuPrimitive.Separator
        data-slot="dropdown-menu-separator"
        className={cn("h-px bg-base-300", className)}
        {...props}
      />
    </li>
  )
}

function DropdownMenuShortcut({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn(
        "ml-auto text-xs tracking-widest text-base-content/50",
        className
      )}
      {...props}
    />
  )
}

function DropdownMenuSub({
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.Sub>) {
  return <DropdownMenuPrimitive.Sub data-slot="dropdown-menu-sub" {...props} />
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean
}) {
  return (
    <li>
      <DropdownMenuPrimitive.SubTrigger
        data-slot="dropdown-menu-sub-trigger"
        data-inset={inset}
        className={cn(
          "flex cursor-default items-center rounded-xl px-2 py-2 text-sm outline-hidden select-none focus:bg-base-200 data-[inset]:pl-8 data-[state=open]:bg-base-200",
          className
        )}
        {...props}
      >
        {children}
        <ChevronRightIcon className="ml-auto size-4" />
      </DropdownMenuPrimitive.SubTrigger>
    </li>
  )
}

function DropdownMenuSubContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  return (
    <DropdownMenuPrimitive.SubContent
      data-slot="dropdown-menu-sub-content"
      className={cn(
        "z-50 min-w-44 rounded-2xl border border-base-300 bg-base-100 p-2 text-base-content shadow-lg data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
        className
      )}
      {...props}
    >
      <ul className="menu menu-sm w-full rounded-xl p-0">{children}</ul>
    </DropdownMenuPrimitive.SubContent>
  )
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}
