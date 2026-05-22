import "server-only";
import { createClient } from "@/lib/supabase/server";
import { emailsByDay } from "@/lib/analytics/timeseries";
import type {
  CallStatus,
  EmailStatus,
  LeadStatus,
  LinkedInStage,
} from "@/lib/types";

/** Single bundle of data the Channels hub renders. */
export interface HubData {
  total: number;
  contacted: number;
  replied: number;
  won: number;
  /** Master tile */
  master: {
    activeCount: number;
    wonCount: number;
    ownersCount: number;
    statusDistribution: { key: LeadStatus; count: number }[];
  };
  /** LinkedIn tile */
  linkedin: {
    reachable: number;
    sent: number;
    accepted: number;
    messaged: number;
    replied: number;
    acceptanceRate: number; // 0..100
    replyRate: number; // 0..100
    inMotion: number;
    funnel: { label: string; count: number }[];
  };
  /** Emails tile */
  emails: {
    emailable: number;
    sent: number;
    replied: number;
    bounced: number;
    replyRate: number; // 0..100
    /** 14-day histogram, newest day last. */
    histogram: { sent: number[]; replied: number[]; bounced: number[] };
  };
  /** Calls tile */
  calls: {
    dialable: number;
    dialed: number;
    reached: number;
    voicemail: number;
    pending: number;
    reachRate: number; // 0..100
    /** Top-3 priority leads, ranked by composite score. */
    priorityQueue: { id: string; name: string; company: string | null }[];
    /** "10am" style label, or null when there isn't enough data. */
    bestWindow: string | null;
  };
}

interface LeadSlice {
  id: string;
  owner_id: string | null;
  name: string;
  company: string | null;
  phone: string | null;
  email: string;
  linkedin_url: string | null;
  qualified: "qualified" | "unqualified";
  call_status: CallStatus;
  call_status_updated_at: string | null;
  email_status: EmailStatus;
  linkedin_stage: LinkedInStage;
  lead_status: LeadStatus;
}

const has = (v: string | null | undefined) => !!v && v.trim() !== "";

const LEAD_STATUS_KEYS: LeadStatus[] = [
  "new",
  "active",
  "won",
  "unqualified",
  "dead",
];

const CONNECTION_SENT = new Set<LinkedInStage>([
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

/** Priority score for the Calls "Today's queue". */
function priorityScore(lead: LeadSlice): number {
  let s = 0;
  if (lead.email_status === "replied") s += 10;
  if (lead.linkedin_stage === "connection_accepted") s += 5;
  if (MESSAGED_STAGES.has(lead.linkedin_stage)) s += 7;
  return s;
}

export async function getHubData(avatarId: string): Promise<HubData> {
  const supabase = await createClient();

  const [{ data: leadRows }, histogram] = await Promise.all([
    supabase
      .from("leads")
      .select(
        "id, owner_id, name, company, phone, email, linkedin_url, qualified, call_status, call_status_updated_at, email_status, linkedin_stage, lead_status",
      )
      .eq("avatar_id", avatarId),
    emailsByDay({ avatarId, days: 14 }),
  ]);
  const leads = (leadRows ?? []) as LeadSlice[];

  // ─── Header totals ────────────────────────────────────────────────────
  const total = leads.length;
  let contacted = 0;
  let replied = 0;
  let won = 0;
  for (const l of leads) {
    if (
      l.email_status !== "none" ||
      l.linkedin_stage !== "none" ||
      l.call_status !== "not_called"
    )
      contacted++;
    if (l.email_status === "replied") replied++;
    if (l.lead_status === "won") won++;
  }

  // ─── Master ────────────────────────────────────────────────────────────
  const statusCounts = new Map<LeadStatus, number>();
  for (const k of LEAD_STATUS_KEYS) statusCounts.set(k, 0);
  const owners = new Set<string>();
  let activeCount = 0;
  for (const l of leads) {
    statusCounts.set(l.lead_status, (statusCounts.get(l.lead_status) ?? 0) + 1);
    if (l.owner_id) owners.add(l.owner_id);
    if (l.lead_status === "active") activeCount++;
  }
  const master = {
    activeCount,
    wonCount: statusCounts.get("won") ?? 0,
    ownersCount: owners.size,
    statusDistribution: LEAD_STATUS_KEYS.map((k) => ({
      key: k,
      count: statusCounts.get(k) ?? 0,
    })),
  };

  // ─── LinkedIn ─────────────────────────────────────────────────────────
  let lkReachable = 0,
    lkSent = 0,
    lkAccepted = 0,
    lkMessaged = 0,
    lkReplied = 0,
    lkInMotion = 0;
  for (const l of leads) {
    if (l.qualified !== "qualified" || !has(l.linkedin_url)) continue;
    lkReachable++;
    if (CONNECTION_SENT.has(l.linkedin_stage)) lkSent++;
    if (ACCEPTED_STAGES.has(l.linkedin_stage)) lkAccepted++;
    if (MESSAGED_STAGES.has(l.linkedin_stage)) lkMessaged++;
    if (REPLIED_STAGES.has(l.linkedin_stage)) lkReplied++;
    if (MESSAGED_STAGES.has(l.linkedin_stage)) lkInMotion++;
  }
  const linkedin = {
    reachable: lkReachable,
    sent: lkSent,
    accepted: lkAccepted,
    messaged: lkMessaged,
    replied: lkReplied,
    acceptanceRate: lkSent > 0 ? Math.round((lkAccepted / lkSent) * 100) : 0,
    replyRate: lkMessaged > 0 ? Math.round((lkReplied / lkMessaged) * 100) : 0,
    inMotion: lkInMotion,
    funnel: [
      { label: "Sent", count: lkSent },
      { label: "Accepted", count: lkAccepted },
      { label: "Messaged", count: lkMessaged },
      { label: "Replied", count: lkReplied },
    ],
  };

  // ─── Emails ───────────────────────────────────────────────────────────
  let emEmailable = 0,
    emSent = 0,
    emReplied = 0,
    emBounced = 0;
  for (const l of leads) {
    if (l.qualified !== "qualified" || !has(l.email)) continue;
    emEmailable++;
    if (
      l.email_status === "smartlead_sent" ||
      l.email_status === "replied" ||
      l.email_status === "bounced"
    )
      emSent++;
    if (l.email_status === "replied") emReplied++;
    if (l.email_status === "bounced") emBounced++;
  }
  const emails = {
    emailable: emEmailable,
    sent: emSent,
    replied: emReplied,
    bounced: emBounced,
    replyRate: emSent > 0 ? Math.round((emReplied / emSent) * 100) : 0,
    histogram,
  };

  // ─── Calls ────────────────────────────────────────────────────────────
  const callable: LeadSlice[] = [];
  let clDialed = 0,
    clReached = 0,
    clVoicemail = 0,
    clPending = 0;
  const reachedHourCounts = new Array(24).fill(0) as number[];
  for (const l of leads) {
    if (l.qualified !== "qualified" || !has(l.phone)) continue;
    callable.push(l);
    if (l.call_status === "not_called") clPending++;
    else clDialed++;
    if (l.call_status === "reached") {
      clReached++;
      if (l.call_status_updated_at) {
        const h = new Date(l.call_status_updated_at).getHours();
        reachedHourCounts[h]++;
      }
    }
    if (l.call_status === "voicemail") clVoicemail++;
  }

  // Best window: only emit once we have ≥ 4 reached calls so the answer is
  // meaningful. Pick the hour with the most reaches and label as "Nam–N+1am".
  let bestWindow: string | null = null;
  if (clReached >= 4) {
    let topHour = -1,
      topCount = 0;
    for (let h = 0; h < 24; h++) {
      if (reachedHourCounts[h] > topCount) {
        topCount = reachedHourCounts[h];
        topHour = h;
      }
    }
    if (topHour >= 0) {
      const fmt = (h: number) => {
        const period = h < 12 ? "am" : "pm";
        const hh = h % 12 || 12;
        return `${hh}${period}`;
      };
      bestWindow = `${fmt(topHour)}–${fmt((topHour + 1) % 24)}`;
    }
  }

  const priorityQueue = callable
    .filter((l) => l.call_status !== "reached")
    .map((l) => ({ lead: l, score: priorityScore(l) }))
    .sort(
      (a, b) => b.score - a.score || a.lead.name.localeCompare(b.lead.name),
    )
    .slice(0, 3)
    .map(({ lead }) => ({
      id: lead.id,
      name: lead.name,
      company: lead.company,
    }));

  const calls = {
    dialable: callable.length,
    dialed: clDialed,
    reached: clReached,
    voicemail: clVoicemail,
    pending: clPending,
    reachRate:
      clDialed > 0 ? Math.round((clReached / clDialed) * 100) : 0,
    priorityQueue,
    bestWindow,
  };

  return { total, contacted, replied, won, master, linkedin, emails, calls };
}
