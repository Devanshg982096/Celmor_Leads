"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { labelFor } from "@/lib/apollo-mapping";
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

export default function LeadDetailDrawer({ leadId, onClose, onNotesSaved }: Props) {
  const open = leadId !== null;
  const [lead, setLead] = useState<Lead | null>(null);
  const [activity, setActivity] = useState<ActivityWithActor[]>([]);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [savedNotes, setSavedNotes] = useState("");
  const [isSaving, startSaveTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);

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

  function handleSaveNotes() {
    if (!leadId) return;
    setSaveError(null);
    startSaveTransition(async () => {
      try {
        await updateLeadNotes(leadId, notes);
        setSavedNotes(notes);
        onNotesSaved?.(leadId, notes);
        // Optimistic: prepend a "Notes updated" entry so the user sees their change
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

  const dirty = notes !== savedNotes;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-md md:max-w-lg p-0 overflow-y-auto">
        <SheetHeader className="border-b">
          <SheetTitle>{lead?.name ?? "Lead"}</SheetTitle>
          <SheetDescription>
            {lead?.title ? `${lead.title} · ` : ""}
            {lead?.company ?? ""}
          </SheetDescription>
        </SheetHeader>

        <div className="p-4 space-y-6">
          {loading && (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}

          {!loading && lead && (
            <>
              {/* Pipeline summary */}
              <div className="flex flex-wrap gap-2">
                <Badge variant={LEAD_STATUS_BADGE[lead.lead_status]}>
                  {labelOf(LEAD_STATUS_OPTIONS, lead.lead_status)}
                </Badge>
                <Badge variant={EMAIL_STATUS_BADGE[lead.email_status]}>
                  Email: {labelOf(EMAIL_STATUS_OPTIONS, lead.email_status)}
                </Badge>
                <Badge variant={LINKEDIN_STAGE_BADGE[lead.linkedin_stage]}>
                  LinkedIn: {labelOf(LINKEDIN_STAGE_OPTIONS, lead.linkedin_stage)}
                </Badge>
                <Badge variant={CALL_STATUS_BADGE[lead.call_status]}>
                  Call: {labelOf(CALL_STATUS_OPTIONS, lead.call_status)}
                </Badge>
              </div>

              {/* Contact details */}
              <div className="space-y-1.5 text-sm">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Contact
                </h3>
                <DetailRow label="Email" value={lead.email} href={`mailto:${lead.email}`} />
                <DetailRow label="Phone" value={lead.phone} href={lead.phone ? `tel:${lead.phone}` : undefined} />
                <DetailRow
                  label="LinkedIn"
                  value={lead.linkedin_url ? "Open profile ↗" : null}
                  href={lead.linkedin_url ?? undefined}
                  external
                />
                <DetailRow label="Company" value={lead.company} />
                <DetailRow label="Title" value={lead.title} />
              </div>

              {/* Raw extra data, if any */}
              {Object.keys(lead.raw_data ?? {}).length > 0 && (
                <RawDataSection rawData={lead.raw_data} />
              )}

              <Separator />

              {/* Notes */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Notes
                  </h3>
                  {dirty && (
                    <span className="text-xs text-muted-foreground">unsaved</span>
                  )}
                </div>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add a note about this lead…"
                  rows={5}
                  disabled={isSaving}
                />
                {saveError && (
                  <p className="text-sm text-destructive">{saveError}</p>
                )}
                <div className="flex justify-end gap-2">
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
              </div>

              <Separator />

              {/* Activity log */}
              <div className="space-y-2">
                <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Activity
                </h3>
                {activity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity yet.</p>
                ) : (
                  <ol className="space-y-2">
                    {activity.map((a) => (
                      <li key={a.id} className="text-sm">
                        <span className="font-medium">{a.actor_name}</span>{" "}
                        <span>{a.action}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {relativeTime(a.created_at)}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetailRow({
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
    <div className="grid grid-cols-[6rem_1fr] items-baseline gap-3">
      <span className="text-muted-foreground text-xs">{label}</span>
      {value ? (
        href ? (
          <a
            href={href}
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            className="text-primary underline-offset-2 hover:underline truncate"
          >
            {value}
          </a>
        ) : (
          <span className="truncate">{value}</span>
        )
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
    </div>
  );
}

function RawDataSection({ rawData }: { rawData: Record<string, unknown> }) {
  const entries = Object.entries(rawData).filter(
    ([k, v]) =>
      v != null && String(v).trim() !== "" &&
      !["name", "email", "company", "title", "linkedin_url", "phone"].includes(k)
  );
  if (entries.length === 0) return null;
  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Other fields ({entries.length})
      </summary>
      <div className="mt-2 space-y-1">
        {entries.map(([k, v]) => (
          <DetailRow key={k} label={labelFor(k)} value={String(v)} />
        ))}
      </div>
    </details>
  );
}
