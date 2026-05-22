"use client"

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"

import { cn } from "@/lib/utils"
import { CheckIcon, MinusIcon } from "lucide-react"

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer relative flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-[var(--border-default)] bg-[var(--bg-elevated)] text-white transition-colors outline-none",
        "after:absolute after:-inset-x-3 after:-inset-y-2",
        "focus-visible:border-[var(--accent-primary)] focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/40",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-checked:border-[var(--accent-primary)] data-checked:bg-[var(--accent-primary)]",
        "data-indeterminate:border-[var(--accent-primary)] data-indeterminate:bg-[var(--accent-primary)]",
        "aria-invalid:border-[var(--status-danger)] aria-invalid:ring-2 aria-invalid:ring-[var(--status-danger)]/30",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-3.5"
      >
        <CheckIcon className="data-[unchecked]:hidden group-data-indeterminate:hidden" />
        <MinusIcon className="hidden group-data-indeterminate:block" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
