import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] px-3 py-1 text-sm text-[var(--text-primary)] transition-colors outline-none",
        "placeholder:text-[var(--text-tertiary)]",
        "focus-visible:border-[var(--accent-primary)] focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/50",
        "disabled:cursor-not-allowed disabled:opacity-60",
        "aria-invalid:border-[var(--status-danger)] aria-invalid:ring-2 aria-invalid:ring-[var(--status-danger)]/30",
        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[var(--text-primary)]",
        className,
      )}
      {...props}
    />
  )
}

export { Input }
