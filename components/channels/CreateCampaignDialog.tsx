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
import { createCampaignAction } from "@/lib/smartlead/actions";
import type { SmartleadCampaign } from "@/lib/smartlead/client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (campaign: SmartleadCampaign) => void;
}

export default function CreateCampaignDialog({
  open,
  onOpenChange,
  onCreated,
}: Props) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startTransition] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createCampaignAction(name);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onCreated(result.campaign);
      setName("");
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
          <DialogTitle>New Smartlead campaign</DialogTitle>
          <DialogDescription>
            Creates an empty campaign in Smartlead. Add a sequence next, then
            connect email accounts and start it from Smartlead (or stay here).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="campaign-name">Name</Label>
            <Input
              id="campaign-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="UK Accountancy — Cold Q3"
              autoFocus
              required
              disabled={isSaving}
            />
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
              {isSaving ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
