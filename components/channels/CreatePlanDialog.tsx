"use client";

import { useState, useTransition } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPlanAction } from "@/lib/planner/actions";
import type { CampaignPlan } from "@/lib/types";
import type { SmartleadCampaign } from "@/lib/smartlead/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  avatarId: string;
  campaigns: SmartleadCampaign[] | null;
  campaignsLoading: boolean;
  onCreated: (plan: CampaignPlan) => void;
}

export default function CreatePlanDialog({
  open,
  onOpenChange,
  avatarId,
  campaigns,
  campaignsLoading,
  onCreated,
}: Props) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState<number>(150);
  const [linked, setLinked] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createPlanAction(
        avatarId,
        name,
        target,
        linked || null,
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onCreated(result.plan);
      setName("");
      setTarget(150);
      setLinked("");
      onOpenChange(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!isSaving) {
          if (!next) setError(null);
          onOpenChange(next);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New campaign plan</DialogTitle>
          <DialogDescription>
            A bucket of leads to enrich and ship to one Smartlead campaign.
            You can link the Smartlead campaign now or later.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="plan-name">Name</Label>
            <Input
              id="plan-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="June outreach — accountancy"
              autoFocus
              required
              disabled={isSaving}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-target">Target lead count</Label>
            <Input
              id="plan-target"
              type="number"
              min={1}
              value={target}
              onChange={(e) => setTarget(Number(e.target.value) || 0)}
              disabled={isSaving}
              className="w-32"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="plan-campaign">Linked Smartlead campaign (optional)</Label>
            <select
              id="plan-campaign"
              value={linked}
              onChange={(e) => setLinked(e.target.value)}
              disabled={isSaving}
              className="h-9 w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-overlay)] px-2 text-sm text-[var(--text-primary)]"
            >
              <option value="">— None (link later) —</option>
              {campaignsLoading && <option disabled>Loading campaigns…</option>}
              {campaigns?.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name} (#{c.id})
                </option>
              ))}
            </select>
          </div>
          {error && <p className="text-[13px] text-[var(--status-danger)]">{error}</p>}
          <DialogFooter>
            <DialogClose
              render={
                <Button variant="ghost" type="button" disabled={isSaving}>
                  Cancel
                </Button>
              }
            />
            <Button type="submit" disabled={isSaving || name.trim().length === 0}>
              {isSaving ? "Creating…" : "Create plan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
