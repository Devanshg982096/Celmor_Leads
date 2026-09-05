"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { handOverCampaign, type HandoverResult } from "@/lib/leads/handover-actions";
import type { Profile } from "@/lib/types";

interface Props {
  /** The campaign being viewed, which is the one taking the list over. */
  avatarId: string;
  avatarName: string;
  /** Every other campaign, as possible sources. */
  others: { id: string; name: string }[];
  profiles: Profile[];
  /** Who is signed in, so their name is the sensible default owner. */
  currentUserId: string;
}

/**
 * The two-week swap.
 *
 * Sahil and Kushal each build a list and send their own connection requests.
 * After two weeks they take over each other's list and approach the same
 * people from their own account.
 */
export default function HandoverDialog({
  avatarId,
  avatarName,
  others,
  profiles,
  currentUserId,
}: Props) {
  const [open, setOpen] = useState(false);
  const [fromId, setFromId] = useState<string>(others[0]?.id ?? "");
  const [ownerId, setOwnerId] = useState<string>(currentUserId);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<HandoverResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const source = others.find((a) => a.id === fromId) ?? null;

  function run() {
    setError(null);
    setDone(null);
    startTransition(async () => {
      const result = await handOverCampaign(fromId, avatarId, ownerId || null);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(result.result);
      router.refresh();
    });
  }

  if (others.length === 0) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setError(null);
          setDone(null);
        }
      }}
    >
      <DialogTrigger>
        <Button variant="outline" size="sm">
          <ArrowLeftRight className="mr-1.5 h-3.5 w-3.5" />
          Take over a list
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Take over a list</DialogTitle>
          <DialogDescription>
            Brings another campaign&apos;s people into {avatarName} so you can send
            your own connection requests to them.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Take over from</Label>
            <Select value={fromId} onValueChange={(v) => setFromId(v ?? fromId)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pick a campaign" />
              </SelectTrigger>
              <SelectContent>
                {others.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Assign them to</Label>
            <Select value={ownerId} onValueChange={(v) => setOwnerId(v ?? ownerId)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pick a person" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3 text-[12px] leading-relaxed text-[var(--text-secondary)]">
            <p>
              {source?.name ?? "The other campaign"} keeps its own copy of everyone,
              at whatever stage they are at. Nothing there is moved or deleted, so
              anyone already replying carries on with the person they are connected
              to.
            </p>
            <p className="mt-2">
              Your copies start at &quot;not started&quot;, ready for you to send
              connection requests. The scraped profile and the written messages come
              across, so this costs nothing to run.
            </p>
            <p className="mt-2">
              Anyone already in {avatarName} is skipped, so running this twice is
              safe.
            </p>
          </div>

          {error && <p className="text-[12px] text-[var(--status-danger)]">{error}</p>}
          {done && (
            <p className="text-[12px] text-[var(--status-success)]">
              Brought {done.copied.toLocaleString("en-GB")} people into {avatarName}.
              {done.alreadyThere > 0
                ? ` ${done.alreadyThere.toLocaleString("en-GB")} were already here and were skipped.`
                : ""}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            {done ? "Close" : "Cancel"}
          </Button>
          <Button size="sm" onClick={run} disabled={!fromId || isPending || !!done}>
            {isPending ? "Bringing them over…" : "Take over the list"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
