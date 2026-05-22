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
import StatusCell from "@/components/leads/StatusCell";
import OwnerCell from "@/components/leads/OwnerCell";
import QualifiedCell from "@/components/leads/QualifiedCell";
import LeadDetailDrawer from "@/components/leads/LeadDetailDrawer";
import KpiBar, { percent, type Kpi } from "@/components/channels/KpiBar";
import ChipRow from "@/components/channels/ChipRow";
import {
  CALL_STATUS_BADGE,
  CALL_STATUS_OPTIONS,
} from "@/lib/leads/labels";
import {
  requalifyLead,
  unqualifyLead,
  updateCallStatus,
  updateLeadOwner,
} from "@/lib/leads/actions";
import { getLeadValue } from "@/lib/leads-columns";
import type {
  CallStatus,
  Lead,
  Profile,
  UnqualifiedReason,
} from "@/lib/types";

interface Props {
  leads: Lead[];
  profiles: Profile[];
}

function splitName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

export default function CallsView({ leads: initialLeads, profiles }: Props) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<CallStatus | "all">("all");

  // Optimistic local patch helper.
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

  // Default sort: not_called first, then by most recently updated call_status_updated_at.
  const sorted = useMemo(() => {
    const copy = [...leads];
    copy.sort((a, b) => {
      const aNotCalled = a.call_status === "not_called" ? 0 : 1;
      const bNotCalled = b.call_status === "not_called" ? 0 : 1;
      if (aNotCalled !== bNotCalled) return aNotCalled - bNotCalled;
      const aT = a.call_status_updated_at ?? a.created_at;
      const bT = b.call_status_updated_at ?? b.created_at;
      return new Date(bT).getTime() - new Date(aT).getTime();
    });
    return copy;
  }, [leads]);

  // Hide unqualified (post-optimistic toggle) AND apply call-status filter.
  const visible = useMemo(
    () =>
      sorted.filter((l) => {
        if (l.qualified !== "qualified") return false;
        if (statusFilter !== "all" && l.call_status !== statusFilter) return false;
        return true;
      }),
    [sorted, statusFilter],
  );

  // KPIs are over the full qualified population — the status filter only narrows
  // the table, not the analytics.
  const qualifiedLeads = useMemo(
    () => sorted.filter((l) => l.qualified === "qualified"),
    [sorted],
  );
  const kpis = useMemo<Kpi[]>(() => {
    const total = qualifiedLeads.length;
    let dialed = 0,
      reached = 0,
      voicemail = 0,
      pending = 0;
    for (const l of qualifiedLeads) {
      if (l.call_status !== "not_called") dialed++;
      else pending++;
      if (l.call_status === "reached") reached++;
      if (l.call_status === "voicemail") voicemail++;
    }
    return [
      { label: "Dialable leads", value: total.toLocaleString() },
      { label: "Dialed", value: dialed.toLocaleString() },
      { label: "Reached rate", value: percent(reached, dialed), hint: `${reached.toLocaleString()} reached` },
      { label: "Voicemail rate", value: percent(voicemail, dialed), hint: `${voicemail.toLocaleString()} voicemails` },
      { label: "Pending", value: pending.toLocaleString(), hint: "not called yet" },
    ];
  }, [qualifiedLeads]);

  return (
    <>
      <KpiBar kpis={kpis} />

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <ChipRow<CallStatus | "all">
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "all", label: "All", count: qualifiedLeads.length },
            ...CALL_STATUS_OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
              count: qualifiedLeads.filter((l) => l.call_status === o.value).length,
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
              <TableHead>First Name</TableHead>
              <TableHead>Last Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Website</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Call Status</TableHead>
              <TableHead className="max-w-xs">Notes</TableHead>
              <TableHead>Qualified</TableHead>
              <TableHead>Owner</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  No qualified leads with a phone number.
                </TableCell>
              </TableRow>
            ) : (
              visible.map((lead) => {
                const { first, last } = splitName(lead.name);
                const website = getLeadValue(lead, "website");
                return (
                  <TableRow
                    key={lead.id}
                    className="cursor-pointer hover:bg-accent/40"
                    onClick={() => setOpenLeadId(lead.id)}
                  >
                    <TableCell className="whitespace-nowrap">{first || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{last || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{lead.company ?? "—"}</TableCell>
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
                      {lead.phone ? (
                        <a
                          href={`tel:${lead.phone}`}
                          className="text-primary underline-offset-2 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {lead.phone}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusCell<CallStatus>
                        value={lead.call_status}
                        options={CALL_STATUS_OPTIONS}
                        variantFor={CALL_STATUS_BADGE}
                        onChange={(next) =>
                          optimisticPatch(
                            lead.id,
                            {
                              call_status: next,
                              call_status_updated_at: new Date().toISOString(),
                            },
                            () => updateCallStatus(lead.id, next),
                          )
                        }
                      />
                    </TableCell>
                    <TableCell className="max-w-xs">
                      {lead.notes ? (
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {lead.notes}
                        </p>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
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
