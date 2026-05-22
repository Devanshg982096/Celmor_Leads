import Sparkline from "@/components/charts/Sparkline";
import { cn } from "@/lib/utils";

export interface KpiCardProps {
  label: string;
  /** Big display value, already-formatted. */
  value: string;
  /** Optional helper line under the value. */
  hint?: string;
  /** Optional delta pill, e.g. "+2pp" / "-0.4pp". */
  delta?: {
    label: string;
    direction: "up" | "down" | "flat";
  };
  /** Optional 12-point sparkline shown in the bottom-right. */
  spark?: {
    data: number[];
    color?: string;
  };
  className?: string;
}

const DELTA_CLASS = {
  up: "bg-[var(--status-success-bg)] text-[var(--status-success)]",
  down: "bg-[var(--status-danger-bg)] text-[var(--status-danger)]",
  flat: "bg-[var(--status-neutral-bg)] text-[var(--text-secondary)]",
} as const;

const DELTA_ARROW = { up: "▲", down: "▼", flat: "·" } as const;

/**
 * Single KPI tile. Pair multiple inside a `.kpi-strip` to get the joined-card
 * panel look from the redesign.
 */
export default function KpiCard({
  label,
  value,
  hint,
  delta,
  spark,
  className,
}: KpiCardProps) {
  return (
    <div
      className={cn(
        "kpi-cell relative flex flex-col gap-1.5 p-4 px-[18px] py-4",
        className,
      )}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
        {label}
      </p>
      <p
        className="font-display text-[28px] leading-[1.1] tracking-[-0.01em]"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </p>
      {(hint || delta) && (
        <div className="flex items-center gap-1.5 text-[11.5px] text-[var(--text-tertiary)]">
          {delta && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-[3px] px-1.5 py-0.5 text-[11px] font-medium",
                "font-mono tabular-nums",
                DELTA_CLASS[delta.direction],
              )}
            >
              <span aria-hidden>{DELTA_ARROW[delta.direction]}</span>
              {delta.label}
            </span>
          )}
          {hint && <span>{hint}</span>}
        </div>
      )}
      {spark && (
        <div className="pointer-events-none absolute right-3 bottom-3 opacity-60">
          <Sparkline
            data={spark.data}
            width={64}
            height={20}
            color={spark.color}
            fill={false}
            endDot={false}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Wrapper to group multiple KpiCards into a single joined-border panel.
 */
export function KpiStrip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("kpi-strip", className)}>{children}</div>;
}
