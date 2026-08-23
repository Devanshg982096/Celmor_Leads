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
import DmCell from "@/components/leads/DmCell";
import GenerateDmBar from "@/components/channels/GenerateDmBar";
import ColumnPicker, {
  useVisibleColumns,
  type ColumnDef,
} from "@/components/channels/ColumnPicker";
import {
  DM_SLOTS,
  dmFor,
  type DmTemplates,
  type DmProgress,
} from "@/lib/leads/linkedin-dm";
import KpiBar, { percent, type Kpi } from "@/components/channels/KpiBar";
import LinkedInFunnel from "@/components/channels/LinkedInFunnel";
import ChipRow from "@/components/channels/ChipRow";
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
  /** Fixed message wording from Settings, applied to each lead at render. */
  dmTemplates: DmTemplates;
  avatarId: string;
  dmProgress: DmProgress;
}

const FLAG_LABEL: Record<string, { text: string; title: string }> = {
  thin: {
    text: "Thin",
    title: "Very little specific to work with. Worth reading before you send.",
  },
  not_accounting: {
    text: "Not an accountant",
    title:
      "This person may not work at an accounting firm. The message says 'We only work with Accounting firms', so check before sending.",
  },
};

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

/** Everything hideable in this table, in display order. */
const COLUMNS: ColumnDef[] = [
  { key: "first_name", label: "First Name", locked: true },
  { key: "last_name", label: "Last Name" },
  { key: "company", label: "Company" },
  ...DM_SLOTS.map((s) => ({ key: `dm_${s.slot}`, label: s.label })),
  { key: "employees", label: "Employees" },
  { key: "website", label: "Website" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "stage", label: "Stage" },
  { key: "days_since", label: "Days since" },
  { key: "qualified", label: "Qualified" },
  { key: "owner", label: "Owner" },
];

export default function LinkedInView({
  leads: initialLeads,
  profiles,
  dmTemplates,
  avatarId,
  dmProgress,
}: Props) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<LinkedInStage | "all">("all");
  const [msgFilter, setMsgFilter] = useState<"all" | "written" | "not_written" | "flagged">("all");
  const { isVisible, toggle, showAll, hiddenCount } = useVisibleColumns(
    "narada-linkedin-columns",
    COLUMNS,
  );

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

  // Most recently written first, so what a run just produced is at the top
  // rather than buried. Generation works oldest-first while this table read
  // newest-first, which put a fresh batch at the bottom of hundreds of rows.
  const sorted = useMemo(() => {
    const copy = [...leads];
    copy.sort((a, b) => {
      const aGen = a.linkedin_dm_generated_at;
      const bGen = b.linkedin_dm_generated_at;
      if (aGen && bGen) return new Date(bGen).getTime() - new Date(aGen).getTime();
      if (aGen) return -1;
      if (bGen) return 1;

      const rankDiff = STAGE_RANK[a.linkedin_stage] - STAGE_RANK[b.linkedin_stage];
      if (rankDiff !== 0) return rankDiff;
      const aT = a.linkedin_stage_updated_at ?? a.created_at;
      const bT = b.linkedin_stage_updated_at ?? b.created_at;
      return new Date(bT).getTime() - new Date(aT).getTime();
    });
    return copy;
  }, [leads]);

  // Hide unqualified (post-optimistic toggle) AND apply stage filter.
  const qualifiedLeads = useMemo(
    () => sorted.filter((l) => l.qualified === "qualified"),
    [sorted],
  );
  const visible = useMemo(
    () =>
      qualifiedLeads
        .filter((l) => stageFilter === "all" || l.linkedin_stage === stageFilter)
        .filter((l) => {
          if (msgFilter === "written") return l.linkedin_open_first !== null;
          if (msgFilter === "not_written") return l.linkedin_open_first === null;
          if (msgFilter === "flagged") return l.linkedin_dm_flag !== null;
          return true;
        }),
    [qualifiedLeads, stageFilter, msgFilter],
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
      <GenerateDmBar avatarId={avatarId} initial={dmProgress} />

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

      <div className="flex flex-wrap items-center gap-3 mb-2">
        <ChipRow<"all" | "written" | "not_written" | "flagged">
          value={msgFilter}
          onChange={setMsgFilter}
          options={[
            { value: "all", label: "All leads", count: qualifiedLeads.length },
            {
              value: "written",
              label: "Message written",
              count: qualifiedLeads.filter((l) => l.linkedin_open_first !== null).length,
            },
            {
              value: "not_written",
              label: "Not written yet",
              count: qualifiedLeads.filter((l) => l.linkedin_open_first === null).length,
            },
            {
              value: "flagged",
              label: "Needs a look",
              count: qualifiedLeads.filter((l) => l.linkedin_dm_flag !== null).length,
            },
          ]}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-3">
        <ChipRow<LinkedInStage | "all">
          value={stageFilter}
          onChange={setStageFilter}
          options={[
            { value: "all", label: "All stages", count: qualifiedLeads.length },
            ...LINKEDIN_STAGE_OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
              count: qualifiedLeads.filter((l) => l.linkedin_stage === o.value).length,
            })),
          ]}
        />
        <p
          className="ml-auto text-[12px] font-mono text-[var(--text-tertiary)]"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {visible.length.toLocaleString("en-GB")} of {qualifiedLeads.length.toLocaleString("en-GB")} leads
        </p>
        <ColumnPicker
          columns={COLUMNS}
          isVisible={isVisible}
          toggle={toggle}
          showAll={showAll}
          hiddenCount={hiddenCount}
        />
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {isVisible("first_name") && <TableHead>First Name</TableHead>}
              {isVisible("last_name") && <TableHead>Last Name</TableHead>}
              {isVisible("company") && <TableHead>Company</TableHead>}
              {/* The messages are the point of this tab, so they sit before
                  the firmographics rather than off the right-hand edge. */}
              {DM_SLOTS.filter((s) => isVisible(`dm_${s.slot}`)).map((s) => (
                <TableHead key={s.slot} className="whitespace-nowrap">
                  {s.label}
                </TableHead>
              ))}
              {isVisible("employees") && <TableHead>Employees</TableHead>}
              {isVisible("website") && <TableHead>Website</TableHead>}
              {isVisible("linkedin") && <TableHead>LinkedIn</TableHead>}
              {isVisible("stage") && <TableHead>Stage</TableHead>}
              {isVisible("days_since") && <TableHead>Days since</TableHead>}
              {isVisible("qualified") && <TableHead>Qualified</TableHead>}
              {isVisible("owner") && <TableHead>Owner</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={COLUMNS.filter((c) => isVisible(c.key)).length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No qualified leads with a LinkedIn URL.
                </TableCell>
              </TableRow>
            ) : (
              visible.map((lead) => {
                const { first, last } = splitName(lead.name);
                const employees = getLeadValue(lead, "employees");
                const website =
                  getLeadValue(lead, "website") ||
                  getLeadValue(lead, "company_website_short");
                return (
                  <TableRow
                    key={lead.id}
                    className="cursor-pointer hover:bg-accent/40"
                    onClick={() => setOpenLeadId(lead.id)}
                  >
                    {isVisible("first_name") && (
                      <TableCell className="whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5">
                          {first || "—"}
                          {lead.linkedin_dm_flag && FLAG_LABEL[lead.linkedin_dm_flag] && (
                            <span
                              title={FLAG_LABEL[lead.linkedin_dm_flag].title}
                              className={
                                "rounded px-1 py-0.5 text-[10px] font-medium " +
                                (lead.linkedin_dm_flag === "not_accounting"
                                  ? "bg-[var(--status-danger)]/15 text-[var(--status-danger)]"
                                  : "bg-[var(--bg-overlay)] text-[var(--text-tertiary)]")
                              }
                            >
                              {FLAG_LABEL[lead.linkedin_dm_flag].text}
                            </span>
                          )}
                        </span>
                      </TableCell>
                    )}
                    {isVisible("last_name") && (
                      <TableCell className="whitespace-nowrap">{last || "—"}</TableCell>
                    )}
                    {isVisible("company") && (
                      <TableCell className="whitespace-nowrap">{lead.company ?? "—"}</TableCell>
                    )}
                    {DM_SLOTS.filter((s) => isVisible(`dm_${s.slot}`)).map((s) => (
                      <TableCell key={s.slot} className="align-top">
                        <DmCell state={dmFor(lead, dmTemplates, s.slot)} />
                      </TableCell>
                    ))}
                    {isVisible("employees") && (
                      <TableCell className="whitespace-nowrap">
                        {employees || <span className="text-muted-foreground">—</span>}
                      </TableCell>
                    )}
                    {isVisible("website") && (
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
                    )}
                    {isVisible("linkedin") && (
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
                    )}
                    {isVisible("stage") && (
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
                    )}
                    {isVisible("days_since") && (
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {lead.linkedin_stage === "none"
                          ? "—"
                          : relativeTime(lead.linkedin_stage_updated_at)}
                      </TableCell>
                    )}
                    {isVisible("qualified") && (
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
                    )}
                    {isVisible("owner") && (
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
                    )}
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
