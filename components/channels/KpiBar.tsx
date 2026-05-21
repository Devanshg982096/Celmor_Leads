import { Card, CardContent } from "@/components/ui/card";

export interface Kpi {
  label: string;
  value: string;
  /** Optional smaller help text under the value */
  hint?: string;
}

export default function KpiBar({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
      {kpis.map((kpi) => (
        <Card key={kpi.label}>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {kpi.label}
            </p>
            <p className="text-2xl font-bold tracking-tight mt-1">{kpi.value}</p>
            {kpi.hint && (
              <p className="text-xs text-muted-foreground mt-1">{kpi.hint}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function percent(num: number, denom: number): string {
  if (denom === 0) return "—";
  return `${Math.round((num / denom) * 100)}%`;
}
