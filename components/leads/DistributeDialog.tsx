"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import UserAvatarBubble from "@/components/ui/UserAvatarBubble";
import { distributeLeads } from "@/lib/leads/actions";
import type { Lead, Profile } from "@/lib/types";

type Scope = "all" | "unassigned" | "filtered";
type Method = "random" | "alphabetical";

interface Props {
  allLeads: Lead[];
  filteredLeads: Lead[];
  profiles: Profile[];
  /** Called with the patch so the parent table can optimistically update. */
  onApplied: (assignments: { ownerId: string; leadIds: string[] }[]) => void;
}

/**
 * Smart distribution dialog. Lets you split a scope of leads (all / unassigned
 * / current filter) across selected owners by percentage. Method is either
 * random or alphabetical round-robin (stable / repeatable by name).
 */
export default function DistributeDialog({
  allLeads,
  filteredLeads,
  profiles,
  onApplied,
}: Props) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<Scope>("unassigned");
  const [method, setMethod] = useState<Method>("random");
  const [shares, setShares] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // Default selection: first two profiles, 50/50.
  useMemo(() => {
    if (Object.keys(shares).length === 0 && profiles.length > 0) {
      const next: Record<string, number> = {};
      if (profiles.length >= 2) {
        next[profiles[0].id] = 50;
        next[profiles[1].id] = 50;
      } else {
        next[profiles[0].id] = 100;
      }
      setShares(next);
    }
  }, [profiles, shares]);

  const scoped = useMemo(() => {
    if (scope === "all") return allLeads;
    if (scope === "filtered") return filteredLeads;
    return allLeads.filter((l) => l.owner_id === null);
  }, [scope, allLeads, filteredLeads]);

  const activeOwnerIds = Object.keys(shares).filter((id) => (shares[id] ?? 0) > 0);
  const totalShare = activeOwnerIds.reduce((s, id) => s + (shares[id] || 0), 0);

  // Compute per-owner counts (largest-remainder method so they sum to scoped.length)
  const distribution = useMemo<{ ownerId: string; count: number }[]>(() => {
    if (totalShare === 0 || scoped.length === 0) return [];
    const raw = activeOwnerIds.map((id) => ({
      ownerId: id,
      raw: (scoped.length * (shares[id] || 0)) / totalShare,
    }));
    const floors = raw.map((r) => ({ ...r, count: Math.floor(r.raw) }));
    let remaining = scoped.length - floors.reduce((s, f) => s + f.count, 0);
    floors.sort((a, b) => b.raw - Math.floor(b.raw) - (a.raw - Math.floor(a.raw)));
    for (let i = 0; remaining > 0; i = (i + 1) % floors.length, remaining--) {
      floors[i].count += 1;
    }
    return floors.map(({ ownerId, count }) => ({ ownerId, count }));
  }, [activeOwnerIds, shares, totalShare, scoped.length]);

  function setShare(id: string, val: number) {
    setShares((prev) => ({ ...prev, [id]: Math.max(0, Math.min(100, val)) }));
  }

  function evenSplit() {
    const ids = Object.keys(shares);
    if (ids.length === 0) return;
    const base = Math.floor(100 / ids.length);
    const remainder = 100 - base * ids.length;
    const next: Record<string, number> = {};
    ids.forEach((id, i) => {
      next[id] = base + (i < remainder ? 1 : 0);
    });
    setShares(next);
  }

  function handleSubmit() {
    if (totalShare !== 100) {
      setError("Shares must sum to 100%.");
      return;
    }
    if (scoped.length === 0) {
      setError("No leads in the selected scope.");
      return;
    }

    // Build ordered list per method.
    let ordered = scoped.slice();
    if (method === "alphabetical") {
      ordered.sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
    } else {
      // Fisher-Yates shuffle (random)
      ordered = ordered.slice();
      for (let i = ordered.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
      }
    }

    // Slice into chunks according to distribution
    const assignments: { ownerId: string; leadIds: string[] }[] = [];
    let cursor = 0;
    for (const { ownerId, count } of distribution) {
      const slice = ordered.slice(cursor, cursor + count);
      cursor += count;
      assignments.push({ ownerId, leadIds: slice.map((l) => l.id) });
    }

    setError(null);
    startTransition(async () => {
      try {
        await distributeLeads(assignments);
        onApplied(assignments);
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Distribution failed.");
      }
    });
  }

  const scopeCounts = {
    all: allLeads.length,
    unassigned: allLeads.filter((l) => l.owner_id === null).length,
    filtered: filteredLeads.length,
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setError(null);
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5">
            <Shuffle className="size-3.5" />
            Distribute
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Distribute leads</DialogTitle>
          <DialogDescription>
            Split a scope of leads across owners by percentage.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* Scope */}
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
              Scope
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {(["unassigned", "filtered", "all"] as Scope[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  className={`rounded-md border px-2 py-1.5 text-left text-[12px] transition-colors ${
                    scope === s
                      ? "border-[var(--accent-primary)] bg-[var(--accent-subtle)] text-[var(--text-primary)]"
                      : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)]"
                  }`}
                >
                  <div className="font-medium capitalize">
                    {s === "filtered" ? "Filtered" : s === "unassigned" ? "Unassigned" : "All leads"}
                  </div>
                  <div className="text-[11px] text-[var(--text-tertiary)]" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {scopeCounts[s].toLocaleString("en-GB")} leads
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Method */}
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
              Method
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {(["random", "alphabetical"] as Method[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethod(m)}
                  className={`rounded-md border px-2 py-1.5 text-[12px] transition-colors ${
                    method === m
                      ? "border-[var(--accent-primary)] bg-[var(--accent-subtle)] text-[var(--text-primary)]"
                      : "border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)]"
                  }`}
                >
                  <div className="font-medium capitalize">{m}</div>
                  <div className="text-[11px] text-[var(--text-tertiary)]">
                    {m === "random" ? "Shuffle then split" : "A→Z round-robin"}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Shares */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                Split between
              </p>
              <button
                type="button"
                onClick={evenSplit}
                className="text-[11px] text-[var(--accent-soft)] hover:underline"
              >
                Even split
              </button>
            </div>
            <div className="space-y-1.5">
              {profiles.map((p) => {
                const share = shares[p.id] ?? 0;
                const count = distribution.find((d) => d.ownerId === p.id)?.count ?? 0;
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-overlay)] px-2 py-1.5"
                  >
                    <UserAvatarBubble id={p.id} name={p.display_name} size={22} />
                    <span className="flex-1 truncate text-[13px]">{p.display_name}</span>
                    <span
                      className="text-[11px] text-[var(--text-tertiary)]"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      → {count.toLocaleString("en-GB")}
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={share}
                      onChange={(e) => setShare(p.id, parseInt(e.target.value || "0", 10))}
                      className="h-7 w-16 rounded-md border border-[var(--border-default)] bg-[var(--bg-base)] px-2 text-right text-[12px] text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    />
                    <span className="text-[11px] text-[var(--text-tertiary)]">%</span>
                  </div>
                );
              })}
            </div>
            <p
              className={`mt-1.5 text-[11px] ${
                totalShare === 100
                  ? "text-[var(--text-tertiary)]"
                  : "text-[var(--status-warning)]"
              }`}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              Total: {totalShare}% {totalShare !== 100 && "— must equal 100%"}
            </p>
          </div>

          {error && (
            <p className="text-[12px] text-[var(--status-danger)]">{error}</p>
          )}
        </div>

        <DialogFooter>
          <DialogClose
            render={
              <Button variant="ghost" size="sm" type="button" disabled={isPending}>
                Cancel
              </Button>
            }
          />
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isPending || totalShare !== 100 || scoped.length === 0}
          >
            {isPending
              ? "Distributing…"
              : `Distribute ${scoped.length.toLocaleString("en-GB")} leads`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
