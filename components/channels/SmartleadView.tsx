"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getCampaignDetailAction,
  listCampaignsAction,
} from "@/lib/smartlead/actions";
import type {
  SmartleadAnalytics,
  SmartleadCampaign,
  SmartleadSequenceStep,
} from "@/lib/smartlead/client";

interface Props {
  initialCampaigns: SmartleadCampaign[] | null;
  initialError: string | null;
}

export default function SmartleadView({ initialCampaigns, initialError }: Props) {
  const [campaigns, setCampaigns] = useState<SmartleadCampaign[] | null>(initialCampaigns);
  const [error, setError] = useState<string | null>(initialError);
  const [selectedId, setSelectedId] = useState<number | null>(
    initialCampaigns && initialCampaigns.length > 0 ? initialCampaigns[0].id : null,
  );
  const [sequence, setSequence] = useState<SmartleadSequenceStep[]>([]);
  const [analytics, setAnalytics] = useState<SmartleadAnalytics | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isLoadingDetail, startDetailTransition] = useTransition();
  const [isRefreshing, startRefreshTransition] = useTransition();

  // Load detail for the currently selected campaign
  useEffect(() => {
    if (selectedId === null) {
      setSequence([]);
      setAnalytics(null);
      setDetailError(null);
      return;
    }
    setDetailError(null);
    setSequence([]);
    setAnalytics(null);
    startDetailTransition(async () => {
      const result = await getCampaignDetailAction(selectedId);
      if (!result.ok) {
        setDetailError(result.error);
        return;
      }
      setSequence(result.sequence);
      setAnalytics(result.analytics);
    });
  }, [selectedId]);

  function refresh() {
    setError(null);
    startRefreshTransition(async () => {
      const result = await listCampaignsAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setCampaigns(result.campaigns);
      if (result.campaigns.length > 0 && selectedId === null) {
        setSelectedId(result.campaigns[0].id);
      }
    });
  }

  if (error) {
    return (
      <div className="rounded-md border border-[var(--status-danger)] bg-[var(--bg-overlay)] p-6">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          Couldn&apos;t reach Smartlead
        </h3>
        <p className="mt-1 text-[13px] text-[var(--text-secondary)]">{error}</p>
        <div className="mt-3 flex gap-2">
          <Button size="sm" onClick={refresh} disabled={isRefreshing}>
            {isRefreshing ? "Retrying…" : "Retry"}
          </Button>
          <a
            href="/settings"
            className="inline-flex h-8 items-center rounded-md border border-[var(--border-default)] bg-transparent px-3 text-[13px] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-overlay)]"
          >
            Open Settings
          </a>
        </div>
      </div>
    );
  }

  if (!campaigns || campaigns.length === 0) {
    return (
      <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-overlay)] p-8 text-center">
        <p className="text-sm text-[var(--text-secondary)]">
          No campaigns found in Smartlead yet.
        </p>
        <div className="mt-3 flex justify-center gap-2">
          <Button size="sm" variant="outline" onClick={refresh} disabled={isRefreshing}>
            {isRefreshing ? "Refreshing…" : "Refresh"}
          </Button>
          <a
            href="https://app.smartlead.ai/app/email-campaign/all"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center rounded-md border border-[var(--border-default)] bg-transparent px-3 text-[13px] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-overlay)]"
          >
            Open Smartlead ↗
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
      {/* Campaign list */}
      <aside className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
            Campaigns
          </h3>
          <button
            type="button"
            onClick={refresh}
            disabled={isRefreshing}
            className="text-[11px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          >
            {isRefreshing ? "…" : "Refresh"}
          </button>
        </div>
        <ul className="space-y-1">
          {campaigns.map((c) => {
            const isSelected = c.id === selectedId;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={
                    "w-full rounded-md border px-3 py-2 text-left transition-colors " +
                    (isSelected
                      ? "border-[var(--accent-soft)] bg-[var(--bg-overlay)]"
                      : "border-[var(--border-subtle)] hover:bg-[var(--bg-overlay)]")
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-[13px] text-[var(--text-primary)]">
                      {c.name}
                    </p>
                    <Badge variant="outline">{c.status}</Badge>
                  </div>
                  <p className="mt-0.5 font-mono text-[11px] text-[var(--text-tertiary)]">
                    #{c.id}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Detail */}
      <main className="min-w-0">
        {selectedId === null ? (
          <p className="text-[13px] text-[var(--text-tertiary)]">
            Pick a campaign to see its sequence and stats.
          </p>
        ) : isLoadingDetail ? (
          <p className="text-[13px] text-[var(--text-tertiary)]">Loading campaign…</p>
        ) : detailError ? (
          <p className="text-[13px] text-[var(--status-danger)]">{detailError}</p>
        ) : (
          <div className="space-y-5">
            <Analytics a={analytics} />
            <Sequence steps={sequence} />
          </div>
        )}
      </main>
    </div>
  );
}

function Analytics({ a }: { a: SmartleadAnalytics | null }) {
  if (!a) return null;
  const rows: { label: string; value: string }[] = [
    { label: "Total leads", value: (a.total_lead_count ?? 0).toLocaleString() },
    { label: "Sent", value: (a.sent_count ?? a.unique_sent_count ?? 0).toLocaleString() },
    { label: "Opens", value: (a.open_count ?? 0).toLocaleString() },
    { label: "Replies", value: (a.reply_count ?? 0).toLocaleString() },
    { label: "Bounces", value: (a.bounce_count ?? 0).toLocaleString() },
  ];
  return (
    <section>
      <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
        Analytics
      </h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {rows.map((r) => (
          <div
            key={r.label}
            className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-overlay)] px-3 py-2"
          >
            <p className="text-[10.5px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
              {r.label}
            </p>
            <p
              className="mt-0.5 font-mono text-[18px] text-[var(--text-primary)]"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {r.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Sequence({ steps }: { steps: SmartleadSequenceStep[] }) {
  return (
    <section>
      <h3 className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
        Sequence ({steps.length} step{steps.length === 1 ? "" : "s"})
      </h3>
      {steps.length === 0 ? (
        <p className="text-[13px] text-[var(--text-tertiary)]">
          No sequence steps configured.
        </p>
      ) : (
        <ol className="space-y-2">
          {steps.map((step, i) => (
            <li
              key={step.id ?? i}
              className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-overlay)] px-3 py-2.5"
            >
              <div className="mb-1 flex items-center justify-between text-[11px] text-[var(--text-tertiary)]">
                <span className="font-medium uppercase tracking-[0.06em]">
                  Step {step.seq_number ?? i + 1}
                </span>
                {step.seq_delay_details?.delay_in_days !== undefined && (
                  <span>wait {step.seq_delay_details.delay_in_days}d</span>
                )}
              </div>
              {step.subject && (
                <p className="text-[13px] font-medium text-[var(--text-primary)]">
                  {step.subject}
                </p>
              )}
              {step.email_body && (
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[12.5px] text-[var(--text-secondary)]">
                  {stripHtml(step.email_body)}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
      <p className="mt-3 text-[11px] text-[var(--text-tertiary)]">
        Read-only for now. Editing sequences lands in the next phase.
      </p>
    </section>
  );
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
