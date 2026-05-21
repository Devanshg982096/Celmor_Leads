"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type {
  CallStatus,
  EmailStatus,
  LeadStatus,
  LinkedInStage,
} from "@/lib/types";

async function logActivity(
  leadId: string,
  userId: string,
  action: string,
) {
  const supabase = await createClient();
  await supabase.from("activity_log").insert({
    lead_id: leadId,
    user_id: userId,
    action,
  });
}

async function getActorOrThrow() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, userId: user.id };
}

export async function updateLeadOwner(leadId: string, ownerId: string | null) {
  const { supabase, userId } = await getActorOrThrow();

  let ownerLabel = "Unassigned";
  if (ownerId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", ownerId)
      .maybeSingle();
    ownerLabel = (profile as { display_name: string } | null)?.display_name ?? "Unknown";
  }

  const { error } = await supabase.from("leads").update({ owner_id: ownerId }).eq("id", leadId);
  if (error) throw new Error(error.message);

  await logActivity(leadId, userId, `Reassigned to ${ownerLabel}`);
  revalidatePath("/", "layout");
}

export async function updateEmailStatus(leadId: string, status: EmailStatus) {
  const { supabase, userId } = await getActorOrThrow();
  const { error } = await supabase
    .from("leads")
    .update({
      email_status: status,
      email_status_updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);
  if (error) throw new Error(error.message);

  await logActivity(leadId, userId, `Email status → ${status}`);
  revalidatePath("/", "layout");
}

export async function updateLinkedInStage(leadId: string, stage: LinkedInStage) {
  const { supabase, userId } = await getActorOrThrow();
  const { error } = await supabase
    .from("leads")
    .update({
      linkedin_stage: stage,
      linkedin_stage_updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);
  if (error) throw new Error(error.message);

  await logActivity(leadId, userId, `LinkedIn stage → ${stage}`);
  revalidatePath("/", "layout");
}

export async function updateCallStatus(leadId: string, status: CallStatus) {
  const { supabase, userId } = await getActorOrThrow();
  const { error } = await supabase
    .from("leads")
    .update({
      call_status: status,
      call_status_updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);
  if (error) throw new Error(error.message);

  await logActivity(leadId, userId, `Call status → ${status}`);
  revalidatePath("/", "layout");
}

export async function updateLeadStatus(leadId: string, status: LeadStatus) {
  const { supabase, userId } = await getActorOrThrow();
  const { error } = await supabase
    .from("leads")
    .update({
      lead_status: status,
      lead_status_updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);
  if (error) throw new Error(error.message);

  await logActivity(leadId, userId, `Lead status → ${status}`);
  revalidatePath("/", "layout");
}
