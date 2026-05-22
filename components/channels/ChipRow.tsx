"use client";

import { cn } from "@/lib/utils";

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  /** Optional count rendered as a small mono badge inside the chip. */
  count?: number;
}

interface Props<T extends string> {
  options: ChipOption<T>[];
  value: T;
  onChange: (next: T) => void;
  className?: string;
}

/**
 * Pill-shaped filter chip row used on the channel drill-in pages.
 * Active chip uses --accent-subtle background + --accent-soft text.
 * Each chip can carry a small mono count badge on the right.
 */
export default function ChipRow<T extends string>({
  options,
  value,
  onChange,
  className,
}: Props<T>) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 text-[12px] transition-colors",
              "h-7",
              active
                ? "border-[var(--accent-primary)] bg-[var(--accent-subtle)] text-[var(--accent-soft)]"
                : "border-[var(--border-subtle)] bg-[var(--bg-overlay)] text-[var(--text-secondary)] hover:border-[var(--border-default)] hover:text-[var(--text-primary)]",
            )}
          >
            <span>{opt.label}</span>
            {opt.count != null && (
              <span
                className={cn(
                  "font-mono text-[11px]",
                  active
                    ? "text-[var(--accent-soft)]"
                    : "text-[var(--text-tertiary)]",
                )}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {opt.count.toLocaleString("en-GB")}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
