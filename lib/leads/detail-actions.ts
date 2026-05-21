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
