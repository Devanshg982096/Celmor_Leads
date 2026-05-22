import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text-primary)] transition-colors outline-none",
        "placeholder:text-[var(--text-tertiary)]",
        "focus-visible:border-[var(--accent-primary)] focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/50",
        "disabled:cursor-not-allowed disabled:opacity-60",
        "aria-invalid:border-[var(--status-danger)] aria-invalid:ring-2 aria-invalid:ring-[var(--status-danger)]/30",
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
