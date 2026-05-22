import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Narada redesign Badge. Compact dot-led pill (22px tall by default, 18px sm).
 * Variants share the {bg, dot, text} pattern keyed to the status / accent
 * tokens; outline uses a bordered transparent fill for "not started" states.
 */
const badgeVariants = cva(
  "group/badge inline-flex shrink-0 items-center justify-center gap-1.5 overflow-hidden rounded-full border border-transparent whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/40",
  {
    variants: {
      variant: {
        // Accent indigo — currently-in-flight pipeline states
        default:
          "bg-[var(--accent-subtle)] text-[var(--accent-soft)] [a]:hover:bg-[var(--accent-subtle)]/80",
        accent:
          "bg-[var(--accent-subtle)] text-[var(--accent-soft)] [a]:hover:bg-[var(--accent-subtle)]/80",
        // Neutral muted — "new" / passive states
        secondary:
          "bg-[var(--status-neutral-bg)] text-[var(--text-secondary)] [a]:hover:bg-[var(--bg-overlay)]",
        neutral:
          "bg-[var(--status-neutral-bg)] text-[var(--text-secondary)] [a]:hover:bg-[var(--bg-overlay)]",
        // Outline — "not started" states
        outline:
          "border-[var(--border-default)] text-[var(--text-tertiary)] bg-transparent [a]:hover:bg-[var(--bg-overlay)]",
        // Status colours
        destructive:
          "bg-[var(--status-danger-bg)] text-[var(--status-danger)] [a]:hover:bg-[var(--status-danger-bg)]",
        danger:
          "bg-[var(--status-danger-bg)] text-[var(--status-danger)] [a]:hover:bg-[var(--status-danger-bg)]",
        success:
          "bg-[var(--status-success-bg)] text-[var(--status-success)] [a]:hover:bg-[var(--status-success-bg)]",
        warning:
          "bg-[var(--status-warning-bg)] text-[var(--status-warning)] [a]:hover:bg-[var(--status-warning-bg)]",
        info:
          "bg-[var(--status-info-bg)] text-[var(--status-info)] [a]:hover:bg-[var(--status-info-bg)]",
        ghost:
          "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)]",
        link:
          "bg-transparent text-[var(--accent-primary)] underline-offset-4 hover:underline px-0 h-auto",
      },
      size: {
        default: "h-[22px] px-2 text-[11.5px] font-medium",
        sm: "h-[18px] px-1.5 text-[10.5px] font-medium gap-1",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/**
 * Dot-coloured indicator that matches each variant's foreground colour.
 * Variants without a dot (link, ghost) can pass dot=false.
 */
const DOT_CLASS: Record<string, string> = {
  default: "bg-[var(--accent-primary)]",
  accent: "bg-[var(--accent-primary)]",
  secondary: "bg-[var(--text-tertiary)]",
  neutral: "bg-[var(--text-tertiary)]",
  outline: "bg-[var(--text-tertiary)]",
  destructive: "bg-[var(--status-danger)]",
  danger: "bg-[var(--status-danger)]",
  success: "bg-[var(--status-success)]",
  warning: "bg-[var(--status-warning)]",
  info: "bg-[var(--status-info)]",
  ghost: "bg-[var(--text-tertiary)]",
  link: "bg-[var(--accent-primary)]",
}

interface BadgeProps
  extends useRender.ComponentProps<"span">,
    VariantProps<typeof badgeVariants> {
  /** Show the leading coloured dot. Defaults to true. */
  dot?: boolean
}

function Badge({
  className,
  variant = "default",
  size = "default",
  render,
  dot = true,
  children,
  ...props
}: BadgeProps) {
  const variantKey = (variant ?? "default") as keyof typeof DOT_CLASS
  const dotSize = size === "sm" ? "size-[5px]" : "size-[6px]"
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant, size }), className),
        children: (
          <>
            {dot && variant !== "link" && variant !== "ghost" && (
              <span
                className={cn(
                  "shrink-0 rounded-full",
                  dotSize,
                  DOT_CLASS[variantKey] ?? "bg-[var(--text-tertiary)]",
                )}
                aria-hidden
              />
            )}
            {children}
          </>
        ),
      },
      props,
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
