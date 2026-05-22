import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Narada-restyled Button. No gradients, no scale/translate on press, 6px radius.
const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent text-sm font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Primary indigo, hover brightens to --accent-hover
        default:
          "bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-hover)] aria-expanded:bg-[var(--accent-hover)]",
        // Outline = subtle border + transparent, hover surfaces --bg-overlay
        outline:
          "border-[var(--border-default)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-overlay)] aria-expanded:bg-[var(--bg-overlay)]",
        // Secondary = filled overlay
        secondary:
          "bg-[var(--bg-overlay)] text-[var(--text-primary)] hover:bg-[var(--border-subtle)]",
        // Ghost = transparent, hover --bg-overlay
        ghost:
          "bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-overlay)] aria-expanded:bg-[var(--bg-overlay)]",
        // Destructive = subtle danger tint + danger text (outline-style, not filled)
        destructive:
          "border-[var(--status-danger)]/40 bg-transparent text-[var(--status-danger)] hover:bg-[var(--status-danger)]/10",
        link:
          "bg-transparent text-[var(--accent-primary)] underline-offset-4 hover:underline px-0 h-auto",
      },
      size: {
        default: "h-8 gap-1.5 px-3 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-sm px-2 text-xs [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 px-2.5 text-[0.8rem] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-3.5",
        icon: "size-8",
        "icon-xs": "size-6 rounded-sm [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
