"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  autoAssignLeadsAction,
  deletePlanAction,
  generateIcebreakersAction,
  pushPlanToSmartleadAction,
  unassignAllFromPlanAction,
  updatePlanAction,
  type PlanWithStats,
} from "@/lib/planner/actions";
import { listCampaignsAction } from "@/lib/smartlead/actions";
import type {
  CampaignPlanStatus,
  WorkspaceSettings,
} from "@/lib/types";
import type { SmartleadCampaign } from "@/lib/smartlead/client";
import CreatePlanDialog from "@/components/channels/CreatePlanDialog";

interface Props {
  avatarId: string;
  initialPlans: PlanWithStats[];
  unassignedPoolCount: number;
  smartleadKeyPresent: boolean;
}

const STATUS_VARIANT: Record<
  CampaignPlanStatus,
  "outline" | "default" | "secondary" | "destructive"
> = {
  draft: "outline",
  enriching: "secondary",
  ready: "default",
  pushed: "default",
  done: "default",
};

export default function PlannerView({
  avatarId,
  initialPlans,
  unassignedPoolCount,
  smartleadKeyPresent,
}: Props) {
  const [plans, setPlans] = useState<PlanWithStats[]>(initialPlans);
  const [pool, setPool] = useState(unassignedPoolCount);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialPlans.length > 0 ? initialPlans[0].id : null,
  );
  const [createOpen, setCreateOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<SmartleadCampaign[] | null>(null);
  const [campaignsLoading, setCampaignsLoading] = useState(false);

  async function ensureCampaigns() {
    if (campaigns !== null || campaignsLoading) return;
    setCampaignsLoading(true);
    const result = await listCampaignsAction();
    setCampaigns(result.ok ? result.campaigns : []);
    setCampaignsLoading(false);
  }

  function patchPlan(id: string, patch: Partial<PlanWithStats>) {
    setPlans((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function removePlanLocally(id: string) {
    setPlans((prev) => prev.filter((p) => p.id !== id));
    if (selectedId === id) {
      const next = plans.find((p) => p.id !== id) ?? null;
      setSelectedId(next?.id ?? null);
    }
  }

  const selected = plans.find((p) => p.id === selectedId) ?? null;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[320px_1fr]">
      {/* Plan list */}
      <aside className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
            Plans
          </h3>
          <button
            type="button"
            onClick={() => {
              ensureCampaigns();
              setCreateOpen(true);
            }}
            className="text-[11px] text-[var(--accent-soft)] hover:text-[var(--accent-hover)]"
          >
            + New plan
          </button>
        </div>

        <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-overlay)] px-3 py-2 text-[12px] text-[var(--text-secondary)]">
          <span className="font-mono text-[var(--text-primary)]" style={{ fontVariantNumeric: "tabular-nums" }}>
            {pool.toLocaleString()}
          </span>{" "}
          qualified leads available to assign
        </div>

        {plans.length === 0 ? (
          <p className="px-1 text-[12.5px] text-[var(--text-tertiary)]">
            No plans yet. Create one to start planning a campaign.
          </p>
        ) : (
          <ul className="space-y-1">
            {plans.map((p) => {
              const sel = p.id === selectedId;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className={
                      "w-full rounded-md border px-3 py-2 text-left transition-colors " +
                      (sel
                        ? "border-[var(--accent-soft)] bg-[var(--bg-overlay)]"
                        : "border-[var(--border-subtle)] hover:bg-[var(--bg-overlay)]")
                    }
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-[13px] text-[var(--text-primary)]">
                        {p.name}
                      </p>
                      <Badge variant={STATUS_VARIANT[p.status]}>{p.status}</Badge>
                    </div>
                    <p
                      className="mt-1 font-mono text-[11px] text-[var(--text-tertiary)]"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {p.assigned_count}/{p.target_lead_count} assigned · {p.enriched_count} enriched · {p.pushed_count} pushed
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      {/* Plan detail */}
      <main className="min-w-0">
        {selected ? (
          <PlanDetail
            key={selected.id}
            plan={selected}
            campaigns={campaigns}
            campaignsLoading={campaignsLoading}
            ensureCampaigns={ensureCampaigns}
            smartleadKeyPresent={smartleadKeyPresent}
            poolCount={pool}
            onPatch={(patch) => patchPlan(selected.id, patch)}
            onPoolChange={(delta) => setPool((c) => Math.max(0, c + delta))}
            onDeleted={() => removePlanLocally(selected.id)}
          />
        ) : (
          <p className="text-[13px] text-[var(--text-tertiary)]">
            Create a plan to get started.
          </p>
        )}
      </main>

      <CreatePlanDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        avatarId={avatarId}
        campaigns={campaigns}
        campaignsLoading={campaignsLoading}
        onCreated={(plan) => {
          const withStats: PlanWithStats = {
            ...plan,
            assigned_count: 0,
            enriched_count: 0,
            pushed_count: 0,
          };
          setPlans((prev) => [withStats, ...prev]);
          setSelectedId(plan.id);
        }}
      />
    </div>
  );
}

function PlanDetail({
  plan,
  campaigns,
  campaignsLoading,
  ensureCampaigns,
  smartleadKeyPresent,
  poolCount,
  onPatch,
  onPoolChange,
  onDeleted,
}: {
  plan: PlanWithStats;
  campaigns: SmartleadCampaign[] | null;
  campaignsLoading: boolean;
  ensureCampaigns: () => void;
  smartleadKeyPresent: boolean;
  poolCount: number;
  onPatch: (patch: Partial<PlanWithStats>) => void;
  onPoolChange: (delta: number) => void;
  onDeleted: () => void;
}) {
  const [assignCount, setAssignCount] = useState<number>(
    Math.max(0, plan.target_lead_count - plan.assigned_count),
  );
  const [busy, startBusy] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function run(fn: () => Promise<void>) {
    setError(null);
    setInfo(null);
    startBusy(async () => {
      await fn();
    });
  }

  function runAssign() {
    if (assignCount <= 0) {
      setError("Pick a count > 0.");
      return;
    }
    const want = Math.min(assignCount, poolCount);
    if (want === 0) {
      setError("No unassigned qualified leads available.");
      return;
    }
    run(async () => {
      const result = await autoAssignLeadsAction(plan.id, plan.avatar_id, want);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onPatch({ assigned_count: plan.assigned_count + result.assigned });
      onPoolChange(-result.assigned);
      setInfo(`Assigned ${result.assigned} lead${result.assigned === 1 ? "" : "s"}.`);
    });
  }

  function runUnassignAll() {
    if (!confirm(`Unassign all ${plan.assigned_count} leads from this plan?`)) return;
    run(async () => {
      const result = await unassignAllFromPlanAction(plan.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onPatch({ assigned_count: 0, enriched_count: 0, pushed_count: 0, status: "draft" });
      onPoolChange(result.unassigned);
      setInfo(`Unassigned ${result.unassigned} lead${result.unassigned === 1 ? "" : "s"}.`);
    });
  }

  function runGenerate() {
    run(async () => {
      const result = await generateIcebreakersAction(plan.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.queued === 0) {
        setInfo("Nothing to queue — all assigned leads are already enriched or in flight.");
        return;
      }
      onPatch({ status: "enriching" });
      setInfo(`Queued ${result.queued} lead${result.queued === 1 ? "" : "s"} for the cron. ETA ~${Math.ceil((result.queued / 5) * 3)} min.`);
    });
  }

  function runPush() {
    if (!plan.smartlead_campaign_id) {
      setError("Link a Smartlead campaign to this plan first.");
      return;
    }
    if (!confirm(`Push ${plan.enriched_count} enriched leads to Smartlead campaign ${plan.smartlead_campaign_id}?`)) return;
    run(async () => {
      const result = await pushPlanToSmartleadAction(plan.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onPatch({ status: "pushed", pushed_count: result.pushed });
      setInfo(`Pushed ${result.pushed} · ${result.already_in_campaign} already in campaign · ${result.invalid_email_count} invalid email`);
    });
  }

  function runDelete() {
    if (!confirm(`Delete plan "${plan.name}"? Assigned leads will be unassigned (not deleted).`)) return;
    run(async () => {
      const result = await deletePlanAction(plan.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onPoolChange(plan.assigned_count);
      onDeleted();
    });
  }

  function linkCampaign(idStr: string) {
    const value = idStr || null;
    run(async () => {
      const result = await updatePlanAction(plan.id, { smartlead_campaign_id: value });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onPatch({ smartlead_campaign_id: value });
      setInfo(value ? "Linked." : "Unlinked.");
    });
  }

  const progressEnriched =
    plan.assigned_count === 0 ? 0 : Math.round((plan.enriched_count / plan.assigned_count) * 100);
  const allEnriched = plan.assigned_count > 0 && plan.enriched_count >= plan.assigned_count;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-[22px] leading-tight tracking-[-0.01em] text-[var(--text-primary)]">
            {plan.name}
          </h2>
          <p className="mt-0.5 text-[12px] text-[var(--text-tertiary)]">
            Target {plan.target_lead_count.toLocaleString()} leads · status{" "}
            <span className="text-[var(--text-secondary)]">{plan.status}</span>
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={runDelete} disabled={busy}>
          Delete plan
        </Button>
      </header>

      {/* Progress */}
      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Assigned" value={`${plan.assigned_count} / ${plan.target_lead_count}`} />
        <StatTile label="Enriched" value={`${plan.enriched_count} (${progressEnriched}%)`} />
        <StatTile label="Pushed" value={`${plan.pushed_count}`} />
        <StatTile label="Status" value={plan.status} />
      </section>

      {/* Assign */}
      <section className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-overlay)] p-3 space-y-2">
        <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
          Assign leads (oldest unassigned qualified first)
        </h3>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="assign-count" className="text-[11px]">
              How many
            </Label>
            <Input
              id="assign-count"
              type="number"
              min={1}
              value={assignCount}
              onChange={(e) => setAssignCount(Number(e.target.value) || 0)}
              disabled={busy}
              className="h-8 w-28"
            />
          </div>
          <Button size="sm" onClick={runAssign} disabled={busy || poolCount === 0}>
            Assign
          </Button>
          {plan.assigned_count > 0 && (
            <Button size="sm" variant="ghost" onClick={runUnassignAll} disabled={busy}>
              Unassign all
            </Button>
          )}
          <span className="ml-auto text-[11px] text-[var(--text-tertiary)]">
            {poolCount.toLocaleString()} available in pool
          </span>
        </div>
      </section>

      {/* Smartlead link */}
      <section className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-overlay)] p-3 space-y-2">
        <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
          Linked Smartlead campaign
        </h3>
        {!smartleadKeyPresent ? (
          <p className="text-[12px] text-[var(--text-tertiary)]">
            Set your Smartlead API key in Settings to link a campaign.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={plan.smartlead_campaign_id ?? ""}
              onChange={(e) => linkCampaign(e.target.value)}
              onFocus={ensureCampaigns}
              disabled={busy}
              className="h-8 min-w-[260px] rounded-md border border-[var(--border-default)] bg-[var(--bg-overlay)] px-2 text-sm text-[var(--text-primary)]"
            >
              <option value="">— None —</option>
              {campaignsLoading && <option disabled>Loading campaigns…</option>}
              {campaigns?.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name} (#{c.id})
                </option>
              ))}
            </select>
            {plan.smartlead_campaign_id && (
              <span className="text-[11px] text-[var(--text-tertiary)]">
                #{plan.smartlead_campaign_id}
              </span>
            )}
          </div>
        )}
      </section>

      {/* Generate + Push */}
      <section className="flex flex-wrap items-center gap-2">
        <Button
          onClick={runGenerate}
          disabled={busy || plan.assigned_count === 0 || allEnriched}
        >
          Generate icebreakers
        </Button>
        <Button
          variant={allEnriched ? "default" : "outline"}
          onClick={runPush}
          disabled={busy || !allEnriched || !plan.smartlead_campaign_id || plan.pushed_count > 0}
        >
          Push to Smartlead
        </Button>
        {plan.assigned_count > 0 && !allEnriched && (
          <span className="text-[11px] text-[var(--text-tertiary)]">
            Push unlocks when 100% of assigned leads are enriched.
          </span>
        )}
      </section>

      {info && <p className="text-[12.5px] text-[var(--status-success)]">{info}</p>}
      {error && <p className="text-[12.5px] text-[var(--status-danger)]">{error}</p>}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-overlay)] px-3 py-2">
      <p className="text-[10.5px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
        {label}
      </p>
      <p
        className="mt-0.5 font-mono text-[16px] text-[var(--text-primary)]"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </p>
    </div>
  );
}

// Local declaration to satisfy TS — the un-used import is loud otherwise.
export type _WorkspaceSettings = WorkspaceSettings;
