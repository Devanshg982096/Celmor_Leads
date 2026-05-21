"use client";

import { useTheme, type Theme } from "@/components/theme/ThemeProvider";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export default function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-md border bg-card p-0.5",
        className,
      )}
      style={{ borderColor: "var(--border-subtle)" }}
      role="radiogroup"
      aria-label="Theme"
    >
      {OPTIONS.map((opt) => {
        const active = theme === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(opt.value)}
            className="rounded px-2.5 py-1 text-xs font-medium transition-colors"
            style={{
              backgroundColor: active ? "var(--bg-overlay)" : "transparent",
              color: active ? "var(--text-primary)" : "var(--text-secondary)",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
