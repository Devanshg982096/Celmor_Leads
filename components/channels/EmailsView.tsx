"use client";

import { useMemo, useState, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import ChipRow from "@/components/channels/ChipRow";
import StatusCell from "@/components/leads/StatusCell";
import OwnerCell from "@/components/leads/OwnerCell";
import QualifiedCell from "@/components/leads/QualifiedCell";
import BulkActionBar from "@/components/leads/BulkActionBar";
import LeadDetailDrawer from "@/components/leads/LeadDetailDrawer";
import PushToCampaignDialog from "@/components/leads/PushToCampaignDialog";
import KpiBar, { percent, type Kpi } from "@/components/channels/KpiBar";
import {
  EMAIL_STATUS_BADGE,
  EMAIL_STATUS_OPTIONS,
} from "@/lib/leads/labels";
import {
  bulkUpdateLeadOwner,
  bulkUpdateLeadStatus,
  requalifyLead,
  unqualifyLead,
  updateEmailStatus,
  updateLeadOwner,
} from "@/lib/leads/actions";
import { getLeadValue } from "@/lib/leads-columns";
import type {
  EmailStatus,
  Lead,
  LeadStatus,
  Profile,
  UnqualifiedReason,
} from "@/lib/types";

interface Props {
  leads: Lead[];
  profiles: Profile[];
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

export default function EmailsView({ leads: initialLeads, profiles }: Props) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<EmailStatus | "all">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pushDialogOpen, setPushDialogOpen] = useState(false);

  const optimisticPatch = useCallback(
    async (leadId: string, patch: Partial<Lead>, run: () => Promise<void>) => {
      const previous = leads;
      setLeads((curr) => curr.map((l) => (l.id === leadId ? { ...l, ...patch } : l)));
      try {
        await run();
      } catch (err) {
        setLeads(previous);
        alert(err instanceof Error ? err.message : "Update failed.");
      }
    },
    [leads],
  );

  // Sort: never-sent first, then by created_at (stable).
  const sorted = useMemo(() => {
    const copy = [...leads];
    copy.sort((a, b) => {
      const aNone = a.email_status === "none" ? 0 : 1;
      const bNone = b.email_status === "none" ? 0 : 1;
      if (aNone !== bNone) return aNone - bNone;
      const aT = a.email_status_updated_at ?? a.created_at;
      const bT = b.email_status_updated_at ?? b.created_at;
      return new Date(bT).getTime() - new Date(aT).getTime();
    });
    return copy;
  }, [leads]);

  const qualifiedLeads = useMemo(
    () => sorted.filter((l) => l.qualified === "qualified"),
    [sorted],
  );

  const visible = useMemo(
    () =>
      qualifiedLeads.filter(
        (l) => statusFilter === "all" || l.email_status === statusFilter,
      ),
    [qualifiedLeads, statusFilter],
  );

  const filteredIds = useMemo(() => visible.map((l) => l.id), [visible]);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const someFilteredSelected = filteredIds.some((id) => selected.has(id));

  function toggleAllFiltered(check: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (check) filteredIds.forEach((id) => next.add(id));
      else filteredIds.forEach((id) => next.delete(id));
      return next;
    });
  }

  function toggleRow(id: string, check: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (check) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  // KPIs over the full qualified population so the status filter narrows
  // only the table, not the analytics.
  const kpis = useMemo<Kpi[]>(() => {
    const total = qualifiedLeads.length;
    let sent = 0,
      replied = 0,
      bounced = 0;
    for (const l of qualifiedLeads) {
      if (
        l.email_status === "smartlead_sent" ||
        l.email_status === "replied" ||
        l.email_status === "bounced"
      ) {
        sent++;
      }
      if (l.email_status === "replied") replied++;
      if (l.email_status === "bounced") bounced++;
    }
    return [
      { label: "Emailable leads", value: total.toLocaleString() },
      { label: "Sent", value: sent.toLocaleString() },
      {
        label: "Reply rate",
        value: percent(replied, sent),
        hint: `${replied.toLocaleString()} replied`,
      },
      {
        label: "Bounce rate",
        value: percent(bounced, sent),
        hint: `${bounced.toLocaleString()} bounced`,
      },
    ];
  }, [qualifiedLeads]);

  // ─── Bulk handlers (optimistic) ──────────────────────────────────────
  async function bulkAssignOwner(ownerId: string | null) {
    const ids = Array.from(selected);
    const previous = leads;
    setLeads((curr) =>
      curr.map((l) => (selected.has(l.id) ? { ...l, owner_id: ownerId } : l)),
    );
    try {
      await bulkUpdateLeadOwner(ids, ownerId);
    } catch (err) {
      setLeads(previous);
      alert(err instanceof Error ? err.message : "Bulk update failed.");
    }
  }

  function handlePushedToCampaign(campaignId: number) {
    // Reflect server-side updates locally so the table flips without a refresh.
    const ids = new Set(selected);
    const now = new Date().toISOString();
    setLeads((curr) =>
      curr.map((l) =>
        ids.has(l.id)
          ? {
              ...l,
              email_status: "smartlead_sent",
              email_status_updated_at: now,
              smartlead_campaign_id: String(campaignId),
            }
          : l,
      ),
    );
  }

  async function bulkSetLeadStatus(status: LeadStatus) {
    const ids = Array.from(selected);
    const previous = leads;
    const now = new Date().toISOString();
    setLeads((curr) =>
      curr.map((l) =>
        selected.has(l.id)
          ? { ...l, lead_status: status, lead_status_updated_at: now }
          : l,
      ),
    );
    try {
      await bulkUpdateLeadStatus(ids, status);
    } catch (err) {
      setLeads(previous);
      alert(err instanceof Error ? err.message : "Bulk update failed.");
    }
  }

  return (
    <>
      <BulkActionBar
        selectedCount={selected.size}
        profiles={profiles}
        onClear={() => setSelected(new Set())}
        onAssignOwner={bulkAssignOwner}
        onPushToSmartlead={() => setPushDialogOpen(true)}
        onSetLeadStatus={bulkSetLeadStatus}
      />

      <PushToCampaignDialog
        open={pushDialogOpen}
        onOpenChange={setPushDialogOpen}
        leadIds={Array.from(selected)}
        onPushed={handlePushedToCampaign}
      />

      <KpiBar kpis={kpis} />

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <ChipRow<EmailStatus | "all">
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "all", label: "All", count: qualifiedLeads.length },
            ...EMAIL_STATUS_OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
              count: qualifiedLeads.filter((l) => l.email_status === o.value).length,
            })),
          ]}
        />
        <p
          className="ml-auto text-[12px] font-mono text-[var(--text-tertiary)]"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {visible.length.toLocaleString("en-GB")} of {qualifiedLeads.length.toLocaleString("en-GB")} leads
        </p>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allFilteredSelected}
                  indeterminate={someFilteredSelected && !allFilteredSelected}
                  onCheckedChange={(v) => toggleAllFiltered(v === true)}
                  aria-label="Select all filtered leads"
                />
              </TableHead>
              <TableHead>First Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Website</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Email Status</TableHead>
              <TableHead>Qualified</TableHead>
              <TableHead>Owner</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No qualified leads with an email address.
                </TableCell>
              </TableRow>
            ) : (
              visible.map((lead) => {
                const website =
                  getLeadValue(lead, "website") ||
                  getLeadValue(lead, "company_website_short");
                return (
                  <TableRow
                    key={lead.id}
                    className="cursor-pointer hover:bg-accent/40"
                    onClick={() => setOpenLeadId(lead.id)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(lead.id)}
                        onCheckedChange={(v) => toggleRow(lead.id, v === true)}
                        aria-label="Select row"
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {firstName(lead.name) || "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {lead.company ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {website ? (
                        <a
                          href={website.startsWith("http") ? website : `https://${website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline-offset-2 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Site ↗
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <a
                        href={`mailto:${lead.email}`}
                        className="text-primary underline-offset-2 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {lead.email}
                      </a>
                    </TableCell>
                    <TableCell>
                      <StatusCell<EmailStatus>
                        value={lead.email_status}
                        options={EMAIL_STATUS_OPTIONS}
                        variantFor={EMAIL_STATUS_BADGE}
                        onChange={(next) =>
                          optimisticPatch(
                            lead.id,
                            {
                              email_status: next,
                              email_status_updated_at: new Date().toISOString(),
                            },
                            () => updateEmailStatus(lead.id, next),
                          )
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <QualifiedCell
                        qualified={lead.qualified}
                        reason={lead.unqualified_reason}
                        unqualifiedAt={lead.unqualified_at}
                        onUnqualify={(reason: UnqualifiedReason) =>
                          optimisticPatch(
                            lead.id,
                            {
                              qualified: "unqualified",
                              unqualified_reason: reason,
                              unqualified_at: new Date().toISOString(),
                            },
                            () => unqualifyLead(lead.id, reason),
                          )
                        }
                        onRequalify={() =>
                          optimisticPatch(
                            lead.id,
                            {
                              qualified: "qualified",
                              unqualified_reason: null,
                              unqualified_at: null,
                              unqualified_by: null,
                            },
                            () => requalifyLead(lead.id),
                          )
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <OwnerCell
                        ownerId={lead.owner_id}
                        profiles={profiles}
                        onChange={(next) =>
                          optimisticPatch(lead.id, { owner_id: next }, () =>
                            updateLeadOwner(lead.id, next),
                          )
                        }
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <LeadDetailDrawer
        leadId={openLeadId}
        onClose={() => setOpenLeadId(null)}
        onNotesSaved={(id, newNotes) =>
          setLeads((curr) =>
            curr.map((l) => (l.id === id ? { ...l, notes: newNotes } : l)),
          )
        }
      />
    </>
  );
}
