import * as TogglePrimitive from "@radix-ui/react-toggle"
import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/lib/utils"

const toggleVariants = cva(
  "btn btn-sm inline-flex min-h-9 min-w-9 items-center justify-center gap-2 rounded-btn border-base-300 bg-base-100 text-base-content hover:bg-base-200 data-[state=on]:border-primary/30 data-[state=on]:bg-primary/10 data-[state=on]:text-primary disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "border-transparent shadow-none",
        outline:
          "border border-base-300 bg-base-100 shadow-xs hover:bg-base-200",
      },
      size: {
        default: "h-9 px-2 min-w-9",
        sm: "btn-xs h-8 min-h-8 px-1.5 min-w-8",
        lg: "btn-md h-10 min-h-10 px-2.5 min-w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root> &
  VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
