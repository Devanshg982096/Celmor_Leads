"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  listCampaignsAction,
  pushLeadsToCampaignAction,
} from "@/lib/smartlead/actions";
import type { SmartleadCampaign } from "@/lib/smartlead/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadIds: string[];
  onPushed: (campaignId: number) => void;
}

export default function PushToCampaignDialog({
  open,
  onOpenChange,
  leadIds,
  onPushed,
}: Props) {
  const [campaigns, setCampaigns] = useState<SmartleadCampaign[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isLoading, startLoad] = useTransition();
  const [pushError, setPushError] = useState<string | null>(null);
  const [pushSummary, setPushSummary] = useState<string | null>(null);
  const [isPushing, startPush] = useTransition();

  // Load campaigns when the dialog opens
  useEffect(() => {
    if (!open) return;
    setCampaigns(null);
    setLoadError(null);
    setSelectedId(null);
    setPushError(null);
    setPushSummary(null);
    startLoad(async () => {
      const result = await listCampaignsAction();
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      setCampaigns(result.campaigns);
      if (result.campaigns.length > 0) setSelectedId(result.campaigns[0].id);
    });
  }, [open]);

  function handlePush() {
    if (selectedId === null) return;
    setPushError(null);
    setPushSummary(null);
    startPush(async () => {
      const result = await pushLeadsToCampaignAction(selectedId, leadIds);
      if (!result.ok) {
        setPushError(result.error);
        return;
      }
      const parts: string[] = [];
      parts.push(`${result.upload_count} pushed`);
      if (result.already_in_campaign)
        parts.push(`${result.already_in_campaign} already in campaign`);
      if (result.invalid_email_count)
        parts.push(`${result.invalid_email_count} invalid email`);
      setPushSummary(parts.join(" · "));
      onPushed(selectedId);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Push to Smartlead campaign</DialogTitle>
          <DialogDescription>
            {leadIds.length} lead{leadIds.length === 1 ? "" : "s"} will be sent to
            the selected campaign. Subject line and icebreaker are passed as
            custom fields (<code>subject_line</code>, <code>icebreaker</code>).
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-[13px] text-[var(--text-tertiary)]">Loading campaigns…</p>
        ) : loadError ? (
          <p className="text-[13px] text-[var(--status-danger)]">{loadError}</p>
        ) : campaigns && campaigns.length === 0 ? (
          <p className="text-[13px] text-[var(--text-tertiary)]">
            No campaigns found in Smartlead. Create one there first.
          </p>
        ) : (
          <div className="max-h-[300px] overflow-y-auto space-y-1.5">
            {campaigns?.map((c) => {
              const selected = c.id === selectedId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  disabled={isPushing}
                  className={
                    "flex w-full items-start justify-between gap-2 rounded-md border px-3 py-2 text-left transition-colors disabled:opacity-60 " +
                    (selected
                      ? "border-[var(--accent-soft)] bg-[var(--bg-overlay)]"
                      : "border-[var(--border-subtle)] hover:bg-[var(--bg-overlay)]")
                  }
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-[var(--text-primary)]">
                      {c.name}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] text-[var(--text-tertiary)]">
                      #{c.id}
                    </p>
                  </div>
                  <Badge variant="outline">{c.status}</Badge>
                </button>
              );
            })}
          </div>
        )}

        {pushError && (
          <p className="text-[13px] text-[var(--status-danger)]">{pushError}</p>
        )}
        {pushSummary && (
          <p className="text-[13px] text-[var(--status-success)]">{pushSummary}</p>
        )}

        <DialogFooter>
          <DialogClose
            render={
              <Button variant="ghost" type="button" disabled={isPushing}>
                {pushSummary ? "Close" : "Cancel"}
              </Button>
            }
          />
          {!pushSummary && (
            <Button
              onClick={handlePush}
              disabled={selectedId === null || isPushing || leadIds.length === 0}
            >
              {isPushing ? "Pushing…" : `Push ${leadIds.length} lead${leadIds.length === 1 ? "" : "s"}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
