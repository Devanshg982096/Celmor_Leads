import { Card, CardContent } from "@/components/ui/card";

interface Step {
  label: string;
  count: number;
}

export default function LinkedInFunnel({ steps }: { steps: Step[] }) {
  return (
    <Card className="mb-6">
      <CardContent className="p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-3">
          Funnel
        </p>
        <div className="flex items-center gap-1 overflow-x-auto">
          {steps.map((step, i) => (
            <div key={step.label} className="flex items-center gap-1 shrink-0">
              <div className="rounded-md border bg-background px-3 py-1.5 min-w-[6.5rem]">
                <p className="text-[0.7rem] uppercase tracking-wide text-muted-foreground leading-tight">
                  {step.label}
                </p>
                <p className="text-lg font-semibold leading-tight">
                  {step.count.toLocaleString()}
                </p>
              </div>
              {i < steps.length - 1 && (
                <span className="text-muted-foreground" aria-hidden>
                  →
                </span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
