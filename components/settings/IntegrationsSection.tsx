import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function IntegrationsSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Integrations</CardTitle>
        <CardDescription>
          External services Narada can sync with.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between rounded-md border border-[var(--border-subtle)] px-4 py-3 opacity-70">
          <div>
            <p className="text-sm font-medium text-[var(--text-primary)]">Smartlead</p>
            <p className="text-xs text-[var(--text-secondary)]">
              Auto-sync email status from Smartlead campaigns
            </p>
          </div>
          <Badge variant="outline">Coming soon</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
