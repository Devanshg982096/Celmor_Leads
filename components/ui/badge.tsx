import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Narada Badge: 4px radius, 12px / 500, 22px height. Tinted-fill variants
// for status colours; outline + secondary stay neutral.
const badgeVariants = cva(
  "group/badge inline-flex h-[22px] w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border border-transparent px-2 text-xs font-medium leading-none whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        // Indigo accent fill — for "in progress" / current pipeline states
        default:
          "bg-[var(--accent-subtle)] text-[var(--accent-primary)] [a]:hover:bg-[var(--accent-subtle)]/80",
        // Neutral subtle — for "new" / passive states
        secondary:
          "bg-[var(--bg-overlay)] text-[var(--text-secondary)] [a]:hover:bg-[var(--border-subtle)]",
        // Outline only — for "none" / not-started states
        outline:
          "border-[var(--border-default)] text-[var(--text-secondary)] [a]:hover:bg-[var(--bg-overlay)]",
        // Status colours — alpha fill + full-strength text
        destructive:
          "bg-[var(--status-danger)]/15 text-[var(--status-danger)] [a]:hover:bg-[var(--status-danger)]/25",
        success:
          "bg-[var(--status-success)]/15 text-[var(--status-success)] [a]:hover:bg-[var(--status-success)]/25",
        warning:
          "bg-[var(--status-warning)]/15 text-[var(--status-warning)] [a]:hover:bg-[var(--status-warning)]/25",
        info:
          "bg-[var(--accent-subtle)] text-[var(--accent-primary)] [a]:hover:bg-[var(--accent-subtle)]/80",
        ghost:
          "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)]",
        link:
          "bg-transparent text-[var(--accent-primary)] underline-offset-4 hover:underline px-0 h-auto",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
