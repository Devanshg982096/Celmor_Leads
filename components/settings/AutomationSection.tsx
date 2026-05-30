"use client";

import { useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { setCronEnabled } from "@/lib/settings/workspace-actions";

interface Props {
  initialEnabled: boolean;
}

export default function AutomationSection({ initialEnabled }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startTransition] = useTransition();

  function toggle() {
    const next = !enabled;
    setError(null);
    startTransition(async () => {
      const result = await setCronEnabled(next);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEnabled(next);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Automation</CardTitle>
        <CardDescription>
          Controls Narada&apos;s background workers.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-3 rounded-md border border-[var(--border-subtle)] px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--text-primary)]">
              Auto-enrich qualified leads
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
              When on, a cron runs every 3 minutes and enriches up to 2
              qualified leads per tick (website + LinkedIn scrape + icebreaker
              generation). When off, only manual Enrich button presses run.
            </p>
            <p
              className={
                "mt-1 text-[11px] font-mono " +
                (enabled
                  ? "text-[var(--status-success)]"
                  : "text-[var(--text-tertiary)]")
              }
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {enabled ? "● RUNNING" : "○ PAUSED"}
            </p>
          </div>
          <Button
            size="sm"
            variant={enabled ? "outline" : "default"}
            onClick={toggle}
            disabled={isSaving}
          >
            {isSaving ? "…" : enabled ? "Pause" : "Resume"}
          </Button>
        </div>
        {error && <p className="text-xs text-[var(--status-danger)]">{error}</p>}
      </CardContent>
    </Card>
  );
}
