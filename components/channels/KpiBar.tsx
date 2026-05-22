import KpiCard, { KpiStrip } from "@/components/charts/KpiCard";

export interface Kpi {
  label: string;
  value: string;
  /** Optional smaller help text under the value */
  hint?: string;
  /** Optional inline delta pill */
  delta?: {
    label: string;
    direction: "up" | "down" | "flat";
  };
}

/**
 * Channel-page KPI strip. Internally uses the redesign primitives
 * (KpiStrip wraps multiple KpiCard cells so the panel reads as one).
 * Keeps the same `kpis` prop shape so existing callers don't change.
 */
export default function KpiBar({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="mb-6">
      <KpiStrip>
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            hint={kpi.hint}
            delta={kpi.delta}
          />
        ))}
      </KpiStrip>
    </div>
  );
}

export function percent(num: number, denom: number): string {
  if (denom === 0) return "—";
  return `${Math.round((num / denom) * 100)}%`;
}
