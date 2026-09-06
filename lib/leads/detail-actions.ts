"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActivityLog, Lead } from "@/lib/types";

export interface ActivityWithActor extends ActivityLog {
  actor_name: string;
}

export interface LeadDetail {
  lead: Lead;
  activity: ActivityWithActor[];
}

export async function getLeadDetail(leadId: string): Promise<LeadDetail | null> {
  const supabase = await createClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead) return null;

  const { data: activityRows } = await supabase
    .from("activity_log")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  const activity = (activityRows ?? []) as ActivityLog[];

  // Resolve actor display names (small N — just fetch all distinct user_ids)
  const userIds = Array.from(new Set(activity.map((a) => a.user_id)));
  let nameById = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", userIds);
    nameById = new Map(
      ((profiles ?? []) as { id: string; display_name: string }[]).map((p) => [
        p.id,
        p.display_name,
      ])
    );
  }

  return {
    lead: lead as Lead,
    activity: activity.map((a) => ({
      ...a,
      actor_name: nameById.get(a.user_id) ?? "Unknown",
    })),
  };
}

export async function updateLeadNotes(leadId: string, notes: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("leads")
    .update({ notes })
    .eq("id", leadId);
  if (error) throw new Error(error.message);

  await supabase.from("activity_log").insert({
    lead_id: leadId,
    user_id: user.id,
    action: "Notes updated",
  });

  revalidatePath("/", "layout");
}

/**
 * Set or clear a lead's phone number by hand.
 *
 * The Calls tab is "every lead with a phone number", so saving one here is
 * what puts the lead on that list. A blank saves as null rather than an empty
 * string, or the lead would show up on the Calls tab with nothing to ring.
 */
export async function updateLeadPhone(
  leadId: string,
  phone: string,
): Promise<{ ok: true; phone: string | null } | { ok: false; error: string }> {
  const next = phone.trim();
  // Deliberately loose. Numbers arrive as "+44 20 7946 0958", "020 7946 0958"
  // and "07700 900123 (mobile)", and refusing any of those would be worse than
  // storing what the user typed.
  if (next.length > 40) return { ok: false, error: "That's too long for a phone number." };
  if (next && !/[0-9]/.test(next)) {
    return { ok: false, error: "A phone number needs at least one digit." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const value = next.length === 0 ? null : next;
  const { error } = await supabase.from("leads").update({ phone: value }).eq("id", leadId);
  if (error) return { ok: false, error: error.message };

  await supabase.from("activity_log").insert({
    lead_id: leadId,
    user_id: user.id,
    action: value ? "Phone number added" : "Phone number removed",
  });

  revalidatePath("/", "layout");
  return { ok: true, phone: value };
}
