import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface ChannelStats {
  total: number;
  qualified: number;
  unqualified: number;
  calls: {
    qualifiedDialable: number; // qualified + has phone
    reached: number;
    toFollowUp: number; // called or voicemail (i.e. dialed but not reached)
  };
  linkedin: {
    qualifiedReachable: number; // qualified + has linkedin_url
    connected: number; // accepted or further
    replied: number; // any follow-up stage (proxy: progressed past first_message)
  };
  emails: {
    qualifiedEmailable: number; // qualified + has email
    sent: number;
    replied: number;
  };
}

interface LeadSlice {
  qualified: "qualified" | "unqualified";
  call_status: "not_called" | "called" | "voicemail" | "reached";
  linkedin_stage:
    | "none"
    | "connection_sent"
    | "connection_accepted"
    | "first_message"
    | "first_followup"
    | "second_followup"
    | "third_followup"
    | "dead";
  email_status: "none" | "smartlead_sent" | "replied" | "bounced";
  phone: string | null;
  email: string;
  linkedin_url: string | null;
}

export async function getChannelStats(avatarId: string): Promise<ChannelStats> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select(
      "qualified, call_status, linkedin_stage, email_status, phone, email, linkedin_url",
    )
    .eq("avatar_id", avatarId);

  if (error) throw new Error(error.message);
  const leads = (data ?? []) as LeadSlice[];

  const has = (v: string | null | undefined) => !!v && v.trim() !== "";

  const stats: ChannelStats = {
    total: leads.length,
    qualified: 0,
    unqualified: 0,
    calls: { qualifiedDialable: 0, reached: 0, toFollowUp: 0 },
    linkedin: { qualifiedReachable: 0, connected: 0, replied: 0 },
    emails: { qualifiedEmailable: 0, sent: 0, replied: 0 },
  };

  const FOLLOWUP_STAGES = new Set([
    "first_followup",
    "second_followup",
    "third_followup",
  ]);
  const CONNECTED_STAGES = new Set([
    "connection_accepted",
    "first_message",
    "first_followup",
    "second_followup",
    "third_followup",
  ]);

  for (const l of leads) {
    if (l.qualified === "qualified") stats.qualified++;
    else stats.unqualified++;

    const isQualified = l.qualified === "qualified";

    // Calls
    if (isQualified && has(l.phone)) {
      stats.calls.qualifiedDialable++;
      if (l.call_status === "reached") stats.calls.reached++;
      else if (l.call_status === "called" || l.call_status === "voicemail") {
        stats.calls.toFollowUp++;
      }
    }

    // LinkedIn
    if (isQualified && has(l.linkedin_url)) {
      stats.linkedin.qualifiedReachable++;
      if (CONNECTED_STAGES.has(l.linkedin_stage)) stats.linkedin.connected++;
      if (FOLLOWUP_STAGES.has(l.linkedin_stage)) stats.linkedin.replied++;
    }

    // Emails
    if (isQualified && has(l.email)) {
      stats.emails.qualifiedEmailable++;
      if (
        l.email_status === "smartlead_sent" ||
        l.email_status === "replied" ||
        l.email_status === "bounced"
      ) {
        stats.emails.sent++;
      }
      if (l.email_status === "replied") stats.emails.replied++;
    }
  }

  return stats;
}
