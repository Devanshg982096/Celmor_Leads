import { cn } from "@/lib/utils";

interface Step {
  label: string;
  count: number;
}

interface Props {
  steps: Step[];
}

/**
 * Redesign-1 chevron-ribbon funnel. Each step is a chevron-clipped tile;
 * the first step has a flat left edge, the last a flat right edge, the
 * rest have notch + point.
 *
 * Per the brief, drop-off is shown beneath each step (relative to the
 * previous one). The first step has no drop-off (it's the starting set).
 */
export default function LinkedInFunnel({ steps }: Props) {
  // Per-step drop-off: NaN for the first one (no previous step), then
  // `1 - (curr / prev)` as a percentage (negative numbers mean growth,
  // which shouldn't happen for a real funnel but we still render).
  const dropOffs = steps.map((step, i) => {
    if (i === 0) return null;
    const prev = steps[i - 1].count;
    if (prev === 0) return null;
    return Math.round(((step.count - prev) / prev) * 100);
  });

  return (
    <section
      className="mb-6 rounded-lg border bg-[var(--bg-elevated)] p-4 px-[18px] py-4"
      style={{ borderColor: "var(--border-subtle)" }}
    >
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-tertiary)]">
          Funnel · stage progression
        </h3>
        <p className="text-[11px] text-[var(--text-tertiary)]">
          Drop-off shown beneath each step
        </p>
      </header>

      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}
      >
        {steps.map((step, i) => {
          const drop = dropOffs[i];
          const isDead = step.label.toLowerCase() === "dead";
          const isActive = !isDead && step.count > 0 && step.count >= steps[i - 1]?.count;
          return (
            <div
              key={step.label}
              className={cn(
                "funnel-step",
                isActive && "is-active",
                isDead && "is-dead",
              )}
            >
              <p
                className={cn(
                  "text-[10.5px] font-semibold uppercase tracking-[0.06em]",
                  isActive
                    ? "text-[var(--accent-soft)]"
                    : isDead
                      ? "text-[var(--status-danger)]"
                      : "text-[var(--text-tertiary)]",
                )}
              >
                {step.label}
              </p>
              <p
                className="font-mono text-[18px] font-medium leading-tight mt-0.5"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {step.count.toLocaleString("en-GB")}
              </p>
              {drop != null && (
                <p
                  className="font-mono text-[10.5px] leading-tight mt-px"
                  style={{
                    fontVariantNumeric: "tabular-nums",
                    color:
                      drop < 0
                        ? "var(--text-tertiary)"
                        : "var(--status-success)",
                  }}
                >
                  {drop > 0 ? "+" : ""}
                  {drop}%
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
