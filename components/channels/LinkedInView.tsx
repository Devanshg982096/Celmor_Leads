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
import LinkedInFunnel from "@/components/channels/LinkedInFunnel";
import {
  LINKEDIN_STAGE_BADGE,
  LINKEDIN_STAGE_OPTIONS,
  relativeTime,
} from "@/lib/leads/labels";
import {
  requalifyLead,
  unqualifyLead,
  updateLeadOwner,
  updateLinkedInStage,
} from "@/lib/leads/actions";
import { getLeadValue } from "@/lib/leads-columns";
import type {
  Lead,
  LinkedInStage,
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

// Used for the "none stage at top" sort (none ranks first).
const STAGE_RANK: Record<LinkedInStage, number> = {
  none: 0,
  connection_sent: 1,
  connection_accepted: 1,
  first_message: 1,
  first_followup: 1,
  second_followup: 1,
  third_followup: 1,
  dead: 1,
};

const SENT_STAGES = new Set<LinkedInStage>([
  "connection_sent",
  "connection_accepted",
  "first_message",
  "first_followup",
  "second_followup",
  "third_followup",
  "dead",
]);
const ACCEPTED_STAGES = new Set<LinkedInStage>([
  "connection_accepted",
  "first_message",
  "first_followup",
  "second_followup",
  "third_followup",
]);
const MESSAGED_STAGES = new Set<LinkedInStage>([
  "first_message",
  "first_followup",
  "second_followup",
  "third_followup",
]);
const REPLIED_STAGES = new Set<LinkedInStage>([
  "first_followup",
  "second_followup",
  "third_followup",
]);

export default function LinkedInView({ leads: initialLeads, profiles }: Props) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);

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

  // none-stage first, then by linkedin_stage_updated_at desc.
  const sorted = useMemo(() => {
    const copy = [...leads];
    copy.sort((a, b) => {
      const rankDiff = STAGE_RANK[a.linkedin_stage] - STAGE_RANK[b.linkedin_stage];
      if (rankDiff !== 0) return rankDiff;
      const aT = a.linkedin_stage_updated_at ?? a.created_at;
      const bT = b.linkedin_stage_updated_at ?? b.created_at;
      return new Date(bT).getTime() - new Date(aT).getTime();
    });
    return copy;
  }, [leads]);

  // Hide unqualified after optimistic toggle.
  const visible = useMemo(
    () => sorted.filter((l) => l.qualified === "qualified"),
    [sorted],
  );

  const counts = useMemo(() => {
    let sent = 0,
      accepted = 0,
      messaged = 0,
      replied = 0;
    const byStage = {
      connection_sent: 0,
      connection_accepted: 0,
      first_message: 0,
      first_followup: 0,
      second_followup: 0,
      third_followup: 0,
      dead: 0,
    } as Record<LinkedInStage, number>;
    for (const l of visible) {
      if (l.linkedin_stage in byStage) byStage[l.linkedin_stage]++;
      if (SENT_STAGES.has(l.linkedin_stage)) sent++;
      if (ACCEPTED_STAGES.has(l.linkedin_stage)) accepted++;
      if (MESSAGED_STAGES.has(l.linkedin_stage)) messaged++;
      if (REPLIED_STAGES.has(l.linkedin_stage)) replied++;
    }
    return { sent, accepted, messaged, replied, byStage };
  }, [visible]);

  const kpis = useMemo<Kpi[]>(
    () => [
      { label: "Reachable leads", value: visible.length.toLocaleString() },
      { label: "Requests sent", value: counts.sent.toLocaleString() },
      {
        label: "Acceptance rate",
        value: percent(counts.accepted, counts.sent),
        hint: `${counts.accepted.toLocaleString()} accepted`,
      },
      {
        label: "Reply rate",
        value: percent(counts.replied, counts.messaged),
        hint: `${counts.replied.toLocaleString()} of ${counts.messaged.toLocaleString()} messaged`,
      },
    ],
    [visible.length, counts],
  );

  return (
    <>
      <KpiBar kpis={kpis} />

      <LinkedInFunnel
        steps={[
          { label: "Sent", count: counts.byStage.connection_sent + counts.accepted },
          { label: "Accepted", count: counts.accepted },
          { label: "1st Message", count: counts.byStage.first_message + counts.byStage.first_followup + counts.byStage.second_followup + counts.byStage.third_followup },
          { label: "1st Followup", count: counts.byStage.first_followup + counts.byStage.second_followup + counts.byStage.third_followup },
          { label: "2nd Followup", count: counts.byStage.second_followup + counts.byStage.third_followup },
          { label: "3rd Followup", count: counts.byStage.third_followup },
          { label: "Dead", count: counts.byStage.dead },
        ]}
      />

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>First Name</TableHead>
              <TableHead>Last Name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Employees</TableHead>
              <TableHead>LinkedIn</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Days since</TableHead>
              <TableHead>Qualified</TableHead>
              <TableHead>Owner</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  No qualified leads with a LinkedIn URL.
                </TableCell>
              </TableRow>
            ) : (
              visible.map((lead) => {
                const { first, last } = splitName(lead.name);
                const employees = getLeadValue(lead, "employees");
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
                      {employees || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {lead.linkedin_url ? (
                        <a
                          href={lead.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary underline-offset-2 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Profile ↗
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusCell<LinkedInStage>
                        value={lead.linkedin_stage}
                        options={LINKEDIN_STAGE_OPTIONS}
                        variantFor={LINKEDIN_STAGE_BADGE}
                        onChange={(next) =>
                          optimisticPatch(
                            lead.id,
                            {
                              linkedin_stage: next,
                              linkedin_stage_updated_at: new Date().toISOString(),
                            },
                            () => updateLinkedInStage(lead.id, next),
                          )
                        }
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {lead.linkedin_stage === "none"
                        ? "—"
                        : relativeTime(lead.linkedin_stage_updated_at)}
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
