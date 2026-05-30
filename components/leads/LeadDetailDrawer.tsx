"use client";

import { useEffect, useState, useTransition } from "react";
import { Mail, Phone, ExternalLink, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  CALL_STATUS_BADGE,
  CALL_STATUS_OPTIONS,
  EMAIL_STATUS_BADGE,
  EMAIL_STATUS_OPTIONS,
  LEAD_STATUS_BADGE,
  LEAD_STATUS_OPTIONS,
  LINKEDIN_STAGE_BADGE,
  LINKEDIN_STAGE_OPTIONS,
  relativeTime,
} from "@/lib/leads/labels";
import {
  getLeadDetail,
  updateLeadNotes,
  type ActivityWithActor,
} from "@/lib/leads/detail-actions";
import { enrichLeadAction } from "@/lib/leads/enrichment-actions";
import { getLeadValue } from "@/lib/leads-columns";
import { cn } from "@/lib/utils";
import type { Lead } from "@/lib/types";

interface Props {
  leadId: string | null;
  onClose: () => void;
  onNotesSaved?: (leadId: string, notes: string) => void;
}

function labelOf<T extends string>(
  opts: { value: T; label: string }[],
  value: T,
): string {
  return opts.find((o) => o.value === value)?.label ?? value;
}

export default function LeadDetailDrawer({
  leadId,
  onClose,
  onNotesSaved,
}: Props) {
  const open = leadId !== null;
  const [lead, setLead] = useState<Lead | null>(null);
  const [activity, setActivity] = useState<ActivityWithActor[]>([]);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [savedNotes, setSavedNotes] = useState("");
  const [isSaving, startSaveTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isEnriching, startEnrichTransition] = useTransition();
  const [enrichError, setEnrichError] = useState<string | null>(null);

  // Load lead detail when leadId changes
  useEffect(() => {
    if (!leadId) return;
    let cancelled = false;
    setLoading(true);
    getLeadDetail(leadId)
      .then((detail) => {
        if (cancelled) return;
        if (!detail) {
          setLead(null);
          setActivity([]);
        } else {
          setLead(detail.lead);
          setActivity(detail.activity);
          setNotes(detail.lead.notes ?? "");
          setSavedNotes(detail.lead.notes ?? "");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  // Escape closes the drawer; body scroll lock while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  function handleSaveNotes() {
    if (!leadId) return;
    setSaveError(null);
    startSaveTransition(async () => {
      try {
        await updateLeadNotes(leadId, notes);
        setSavedNotes(notes);
        onNotesSaved?.(leadId, notes);
        // Optimistic prepend so the user sees their change immediately.
        setActivity((prev) => [
          {
            id: `local-${Date.now()}`,
            lead_id: leadId,
            user_id: "local",
            action: "Notes updated",
            created_at: new Date().toISOString(),
            actor_name: "You",
          },
          ...prev,
        ]);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : "Failed to save notes.");
      }
    });
  }

  function handleEnrich() {
    if (!leadId || !lead) return;
    setEnrichError(null);
    startEnrichTransition(async () => {
      const result = await enrichLeadAction(leadId);
      if (!result.ok) {
        setEnrichError(result.error);
        setLead((prev) =>
          prev ? { ...prev, enrichment_status: "failed", enrichment_error: result.error } : prev,
        );
        return;
      }
      // Apify runs are in flight. Flip status to 'enriching'; the polling
      // effect below will pick the result up when Apify finishes.
      setLead((prev) =>
        prev
          ? {
              ...prev,
              enrichment_status: "enriching",
              enrichment_error: null,
            }
          : prev,
      );
    });
  }

  // Poll while an enrichment is in progress. Runs every 5s; stops when the
  // status changes to done/failed/null or the drawer closes.
  useEffect(() => {
    if (!leadId || lead?.enrichment_status !== "enriching") return;
    let cancelled = false;

    async function tick() {
      try {
        const res = await fetch(`/api/enrich/poll/${leadId}`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as {
          lead: {
            enrichment_status: string | null;
            enrichment_error: string | null;
            subject_line: string | null;
            icebreaker: string | null;
            enriched_at: string | null;
          } | null;
        };
        if (cancelled || !body.lead) return;
        setLead((prev) =>
          prev
            ? {
                ...prev,
                enrichment_status: body.lead!.enrichment_status as Lead["enrichment_status"],
                enrichment_error: body.lead!.enrichment_error,
                subject_line: body.lead!.subject_line,
                icebreaker: body.lead!.icebreaker,
                enriched_at: body.lead!.enriched_at,
              }
            : prev,
        );
        if (body.lead.enrichment_status === "done") {
          setActivity((prev) => [
            {
              id: `local-${Date.now()}`,
              lead_id: leadId!,
              user_id: "local",
              action: "Enriched (icebreaker generated)",
              created_at: body.lead!.enriched_at ?? new Date().toISOString(),
              actor_name: "You",
            },
            ...prev,
          ]);
        } else if (body.lead.enrichment_status === "failed" && body.lead.enrichment_error) {
          setEnrichError(body.lead.enrichment_error);
        }
      } catch {
        // Network blip — let the next tick retry.
      }
    }

    // Run once immediately so we don't sit on a stale 'enriching' if the
    // server already finished before this effect mounted.
    void tick();
    const interval = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [leadId, lead?.enrichment_status]);

  const dirty = notes !== savedNotes;
  const employees = lead ? getLeadValue(lead, "employees") : "";
  const city = lead ? getLeadValue(lead, "city") : "";

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/60 transition-opacity duration-200",
          "supports-[backdrop-filter]:backdrop-blur-[4px]",
          open
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none",
        )}
        aria-hidden
      />

      {/* Drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        className={cn(
          "fixed top-0 right-0 bottom-0 z-50 flex w-[480px] max-w-[96vw] flex-col",
          "border-l border-[var(--border-default)] bg-[var(--bg-elevated)]",
          "shadow-[0_16px_48px_rgba(0,0,0,0.5),0_4px_12px_rgba(0,0,0,0.35)]",
          "transition-transform duration-[280ms]",
        )}
        style={{
          transform: open ? "translateX(0)" : "translateX(100%)",
          transitionTimingFunction: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
      >
        {/* Head */}
        <header
          className="flex flex-col gap-3 border-b px-6 pt-[22px] pb-[18px]"
          style={{ borderColor: "var(--border-subtle)" }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-[22px] font-normal leading-tight tracking-[-0.01em] text-[var(--text-primary)]">
                {lead?.name ?? (loading ? "Loading…" : "Lead")}
              </h2>
              {(lead?.title || lead?.company) && (
                <p className="mt-0.5 text-[13px] text-[var(--text-secondary)]">
                  {lead?.title ? lead.title : ""}
                  {lead?.title && lead?.company ? " · " : ""}
                  {lead?.company ?? ""}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-overlay)] hover:text-[var(--text-primary)]"
            >
              <X className="size-4" />
            </button>
          </div>
          {lead && (
            <div className="flex flex-wrap gap-1.5">
              <Badge variant={LEAD_STATUS_BADGE[lead.lead_status]}>
                {labelOf(LEAD_STATUS_OPTIONS, lead.lead_status)}
              </Badge>
              <Badge variant={EMAIL_STATUS_BADGE[lead.email_status]}>
                {labelOf(EMAIL_STATUS_OPTIONS, lead.email_status)}
              </Badge>
              <Badge variant={LINKEDIN_STAGE_BADGE[lead.linkedin_stage]}>
                {labelOf(LINKEDIN_STAGE_OPTIONS, lead.linkedin_stage)}
              </Badge>
              <Badge variant={CALL_STATUS_BADGE[lead.call_status]}>
                {labelOf(CALL_STATUS_OPTIONS, lead.call_status)}
              </Badge>
            </div>
          )}
        </header>

        {/* Body */}
        <div className="flex flex-1 flex-col gap-[22px] overflow-y-auto px-6 py-5">
          {loading && (
            <p className="text-[13px] text-[var(--text-tertiary)]">Loading…</p>
          )}

          {!loading && lead && (
            <>
              {/* Channels — quick action buttons */}
              <section>
                <SectionHeading>Channels</SectionHeading>
                <div className="flex flex-wrap gap-2">
                  {lead.email && (
                    <a
                      href={`mailto:${lead.email}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-overlay)] px-3 text-[12.5px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
                    >
                      <Mail className="size-3.5" />
                      Send email
                    </a>
                  )}
                  {lead.linkedin_url && (
                    <a
                      href={lead.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-overlay)] px-3 text-[12.5px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
                    >
                      <ExternalLink className="size-3.5" />
                      Open LinkedIn
                    </a>
                  )}
                  {lead.phone && (
                    <a
                      href={`tel:${lead.phone}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-overlay)] px-3 text-[12.5px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)]"
                    >
                      <Phone className="size-3.5" />
                      Call {lead.phone}
                    </a>
                  )}
                </div>
              </section>

              {/* Contact details */}
              <section>
                <SectionHeading>Contact</SectionHeading>
                <dl>
                  <KvRow label="Email" value={lead.email} href={`mailto:${lead.email}`} />
                  <KvRow
                    label="Phone"
                    value={lead.phone}
                    href={lead.phone ? `tel:${lead.phone}` : undefined}
                  />
                  <KvRow
                    label="LinkedIn"
                    value={lead.linkedin_url ? "Open profile ↗" : null}
                    href={lead.linkedin_url ?? undefined}
                    external
                  />
                  <KvRow label="Company" value={lead.company} />
                  <KvRow label="Title" value={lead.title} />
                  {employees && <KvRow label="Employees" value={employees} />}
                  {city && <KvRow label="City" value={city} />}
                </dl>
              </section>

              {/* Icebreaker / Enrichment */}
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <SectionHeading className="mb-0">Icebreaker</SectionHeading>
                  <Button
                    size="sm"
                    variant={lead.icebreaker ? "ghost" : "default"}
                    onClick={handleEnrich}
                    disabled={isEnriching || lead.enrichment_status === "enriching"}
                  >
                    <Sparkles className="size-3.5" />
                    {lead.enrichment_status === "enriching"
                      ? "Enriching…"
                      : isEnriching
                        ? "Starting…"
                        : lead.icebreaker
                          ? "Regenerate"
                          : "Enrich & write icebreaker"}
                  </Button>
                </div>
                {lead.icebreaker ? (
                  <div className="space-y-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-overlay)] px-3 py-2.5 text-[13px]">
                    {lead.subject_line && (
                      <div>
                        <p className="text-[10.5px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                          Subject
                        </p>
                        <p className="mt-0.5 text-[var(--text-primary)]">
                          {lead.subject_line}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-[10.5px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                        Opener
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap text-[var(--text-primary)]">
                        {lead.icebreaker}
                      </p>
                    </div>
                    {lead.enriched_at && (
                      <p
                        className="font-mono text-[11px] text-[var(--text-tertiary)]"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        Generated {relativeTime(lead.enriched_at)}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-[13px] text-[var(--text-tertiary)]">
                    {lead.enrichment_status === "failed"
                      ? `Last attempt failed: ${lead.enrichment_error ?? "unknown error"}`
                      : "No icebreaker generated yet."}
                  </p>
                )}
                {enrichError && (
                  <p className="mt-2 text-[12px] text-[var(--status-danger)]">
                    {enrichError}
                  </p>
                )}
              </section>

              {/* Scraped sources — what the LLM saw */}
              {(lead.website_summary || lead.linkedin_summary) && (
                <section>
                  <SectionHeading>Scraped sources</SectionHeading>
                  <div className="space-y-2">
                    {lead.website_summary && (
                      <CollapsibleSource
                        label="Website"
                        text={lead.website_summary}
                      />
                    )}
                    {lead.linkedin_summary && (
                      <CollapsibleSource
                        label="LinkedIn"
                        text={lead.linkedin_summary}
                      />
                    )}
                  </div>
                  <p className="mt-2 text-[11px] text-[var(--text-tertiary)]">
                    Stored after enrichment — reused for future LinkedIn message generation.
                  </p>
                </section>
              )}

              {/* Notes */}
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <SectionHeading className="mb-0">Notes</SectionHeading>
                  {dirty && (
                    <span className="text-[10.5px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                      Unsaved
                    </span>
                  )}
                </div>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add a note about this lead…"
                  rows={5}
                  disabled={isSaving}
                  className="min-h-[90px] bg-[var(--bg-overlay)]"
                />
                {saveError && (
                  <p className="mt-2 text-[12px] text-[var(--status-danger)]">
                    {saveError}
                  </p>
                )}
                <div className="mt-2 flex justify-end gap-2">
                  {dirty && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setNotes(savedNotes)}
                      disabled={isSaving}
                    >
                      Discard
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={handleSaveNotes}
                    disabled={!dirty || isSaving}
                  >
                    {isSaving ? "Saving…" : "Save notes"}
                  </Button>
                </div>
              </section>

              {/* Activity log */}
              <section>
                <SectionHeading>Activity</SectionHeading>
                {activity.length === 0 ? (
                  <p className="text-[13px] text-[var(--text-tertiary)]">
                    No activity yet.
                  </p>
                ) : (
                  <ol>
                    {activity.map((a) => (
                      <li
                        key={a.id}
                        className="flex gap-3 border-b border-dashed py-2.5 last:border-b-0 text-[13px]"
                        style={{ borderColor: "var(--border-subtle)" }}
                      >
                        <span
                          aria-hidden
                          className="mt-1.5 inline-block size-2 shrink-0 rounded-full"
                          style={{ background: "var(--accent-primary)" }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-[var(--text-primary)]">
                            <span className="font-medium">{a.actor_name}</span>{" "}
                            <span className="text-[var(--text-secondary)]">
                              {a.action}
                            </span>
                          </p>
                          <p
                            className="mt-0.5 font-mono text-[11px] text-[var(--text-tertiary)]"
                            style={{ fontVariantNumeric: "tabular-nums" }}
                          >
                            {relativeTime(a.created_at)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

function SectionHeading({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3
      className={cn(
        "mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]",
        className,
      )}
    >
      {children}
    </h3>
  );
}

function CollapsibleSource({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-overlay)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-[13px] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
      >
        <span className="flex items-center gap-2">
          <span aria-hidden className="text-[10px] text-[var(--text-tertiary)]">
            {open ? "▾" : "▸"}
          </span>
          <span className="font-medium">{label}</span>
          <span className="text-[11px] text-[var(--text-tertiary)]">
            {text.length.toLocaleString()} chars
          </span>
        </span>
      </button>
      {open && (
        <div className="border-t border-[var(--border-subtle)] px-3 py-2">
          <pre className="whitespace-pre-wrap break-words font-mono text-[12px] text-[var(--text-secondary)]">
            {text}
          </pre>
        </div>
      )}
    </div>
  );
}

function KvRow({
  label,
  value,
  href,
  external,
}: {
  label: string;
  value: string | null;
  href?: string;
  external?: boolean;
}) {
  return (
    <div
      className="grid grid-cols-[90px_1fr] items-baseline gap-3 border-b py-[7px] text-[13px] last:border-b-0"
      style={{ borderColor: "var(--border-subtle)" }}
    >
      <span className="text-[12px] text-[var(--text-tertiary)]">{label}</span>
      {value ? (
        href ? (
          <a
            href={href}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            className="truncate text-[var(--accent-soft)] underline-offset-2 transition-colors hover:text-[var(--accent-hover)] hover:underline"
          >
            {value}
          </a>
        ) : (
          <span className="truncate text-[var(--text-primary)]">{value}</span>
        )
      ) : (
        <span className="text-[var(--text-tertiary)]">—</span>
      )}
    </div>
  );
}
