"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTheme, type Theme } from "@/components/theme/ThemeProvider";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Theme; label: string; hint: string }[] = [
  { value: "light", label: "Light", hint: "Always light mode" },
  { value: "dark", label: "Dark", hint: "Always dark mode" },
  { value: "system", label: "System", hint: "Follow OS preference" },
];

export default function AppearanceSection() {
  const { theme, setTheme } = useTheme();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>
          Choose how Narada looks on this device.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className="inline-grid grid-cols-3 gap-2"
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
                className={cn(
                  "flex flex-col items-start gap-1 rounded-md border px-4 py-3 text-left transition-colors",
                  active
                    ? "border-[var(--accent-primary)] bg-[var(--accent-subtle)]"
                    : "border-[var(--border-subtle)] bg-transparent hover:bg-[var(--bg-overlay)]",
                )}
              >
                <span
                  className={cn(
                    "text-sm font-medium",
                    active ? "text-[var(--accent-primary)]" : "text-[var(--text-primary)]",
                  )}
                >
                  {opt.label}
                </span>
                <span className="text-xs text-[var(--text-secondary)]">{opt.hint}</span>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
