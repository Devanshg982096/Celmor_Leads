"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { addLeadsToCampaign } from "@/lib/smartlead/client";
import type {
  CampaignPlan,
  CampaignPlanStatus,
  Lead,
  WorkspaceSettings,
} from "@/lib/types";

export interface PlanWithStats extends CampaignPlan {
  assigned_count: number;
  enriched_count: number;
  pushed_count: number;
}

// ─── Read ───────────────────────────────────────────────────────────────────

export async function listPlansAction(avatarId: string): Promise<PlanWithStats[]> {
  const supabase = await createClient();
  const { data: plans } = await supabase
    .from("campaign_plans")
    .select("*")
    .eq("avatar_id", avatarId)
    .order("created_at", { ascending: false });
  if (!plans || plans.length === 0) return [];

  // Fetch all leads with a plan in this avatar in one query, then count locally.
  const planIds = plans.map((p) => (p as CampaignPlan).id);
  const { data: leadRows } = await supabase
    .from("leads")
    .select("campaign_plan_id, icebreaker, email_status")
    .in("campaign_plan_id", planIds);
  const leads = (leadRows ?? []) as Pick<Lead, "campaign_plan_id" | "icebreaker" | "email_status">[];

  const stats = new Map<string, { assigned: number; enriched: number; pushed: number }>();
  for (const l of leads) {
    if (!l.campaign_plan_id) continue;
    const s = stats.get(l.campaign_plan_id) ?? { assigned: 0, enriched: 0, pushed: 0 };
    s.assigned += 1;
    if (l.icebreaker && l.icebreaker.length > 0) s.enriched += 1;
    if (l.email_status === "smartlead_sent" || l.email_status === "replied" || l.email_status === "bounced") {
      s.pushed += 1;
    }
    stats.set(l.campaign_plan_id, s);
  }

  return (plans as CampaignPlan[]).map((p) => {
    const s = stats.get(p.id) ?? { assigned: 0, enriched: 0, pushed: 0 };
    return {
      ...p,
      assigned_count: s.assigned,
      enriched_count: s.enriched,
      pushed_count: s.pushed,
    };
  });
}

// ─── Create / update / delete ───────────────────────────────────────────────

export async function createPlanAction(
  avatarId: string,
  name: string,
  targetLeadCount: number,
  smartleadCampaignId: string | null,
): Promise<{ ok: true; plan: CampaignPlan } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Plan name is required." };
  if (!Number.isFinite(targetLeadCount) || targetLeadCount < 0) {
    return { ok: false, error: "Target lead count must be a non-negative number." };
  }

  const { data, error } = await supabase
    .from("campaign_plans")
    .insert({
      avatar_id: avatarId,
      name: trimmed,
      target_lead_count: Math.floor(targetLeadCount),
      smartlead_campaign_id: smartleadCampaignId,
      status: "draft" as CampaignPlanStatus,
      created_by: user.id,
    })
    .select("*")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed." };

  revalidatePath(`/avatars/${avatarId}/emails`);
  return { ok: true, plan: data as CampaignPlan };
}

export async function updatePlanAction(
  planId: string,
  patch: Partial<Pick<CampaignPlan, "name" | "target_lead_count" | "smartlead_campaign_id" | "status" | "notes">>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("campaign_plans")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", planId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deletePlanAction(
  planId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  // Unassign leads first (FK has ON DELETE SET NULL, but be explicit so the
  // activity is obvious in audit/log if we add one later).
  await supabase.from("leads").update({ campaign_plan_id: null }).eq("campaign_plan_id", planId);
  const { error } = await supabase.from("campaign_plans").delete().eq("id", planId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

// ─── Lead assignment ────────────────────────────────────────────────────────

/**
 * Auto-assign up to `count` of this avatar's qualified, currently-unassigned
 * leads to the given plan. Oldest first (created_at asc), excluding leads
 * already in another plan.
 *
 * Returns the actual number assigned (may be less than requested if the pool
 * is smaller than count).
 */
export async function autoAssignLeadsAction(
  planId: string,
  avatarId: string,
  count: number,
): Promise<{ ok: true; assigned: number } | { ok: false; error: string }> {
  if (!Number.isFinite(count) || count <= 0) {
    return { ok: false, error: "Count must be a positive number." };
  }
  const supabase = await createClient();
  const { data: candidates, error: pickErr } = await supabase
    .from("leads")
    .select("id")
    .eq("avatar_id", avatarId)
    .eq("qualified", "qualified")
    .is("campaign_plan_id", null)
    .order("created_at", { ascending: true })
    .limit(Math.floor(count));
  if (pickErr) return { ok: false, error: pickErr.message };

  const ids = (candidates ?? []).map((r) => (r as { id: string }).id);
  if (ids.length === 0) return { ok: true, assigned: 0 };

  const { error: updateErr } = await supabase
    .from("leads")
    .update({ campaign_plan_id: planId })
    .in("id", ids);
  if (updateErr) return { ok: false, error: updateErr.message };

  revalidatePath(`/avatars/${avatarId}/emails`);
  return { ok: true, assigned: ids.length };
}

export async function unassignAllFromPlanAction(
  planId: string,
): Promise<{ ok: true; unassigned: number } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("leads")
    .select("id")
    .eq("campaign_plan_id", planId);
  const unassigned = (rows ?? []).length;

  const { error } = await supabase
    .from("leads")
    .update({ campaign_plan_id: null })
    .eq("campaign_plan_id", planId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, unassigned };
}

// ─── Enrichment trigger ─────────────────────────────────────────────────────

/**
 * Mark all leads in the plan that don't have an icebreaker yet as 'pending'.
 * The cron tick prefers 'pending' over the regular trickle queue and bumps
 * its batch size, so the plan drains faster than steady-state.
 */
export async function generateIcebreakersAction(
  planId: string,
): Promise<{ ok: true; queued: number } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("leads")
    .select("id, icebreaker, enrichment_status")
    .eq("campaign_plan_id", planId);

  const eligible = (rows ?? []).filter(
    (l) =>
      !(l as Lead).icebreaker &&
      (l as Lead).enrichment_status !== "enriching" &&
      (l as Lead).enrichment_status !== "pending",
  );
  const ids = eligible.map((l) => (l as { id: string }).id);
  if (ids.length === 0) return { ok: true, queued: 0 };

  const { error } = await supabase
    .from("leads")
    .update({ enrichment_status: "pending", enrichment_error: null })
    .in("id", ids);
  if (error) return { ok: false, error: error.message };

  await supabase
    .from("campaign_plans")
    .update({ status: "enriching", updated_at: new Date().toISOString() })
    .eq("id", planId);

  revalidatePath("/", "layout");
  return { ok: true, queued: ids.length };
}

// ─── Push to Smartlead ──────────────────────────────────────────────────────

export async function pushPlanToSmartleadAction(
  planId: string,
): Promise<
  | { ok: true; pushed: number; already_in_campaign: number; invalid_email_count: number }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { data: planRow } = await supabase
    .from("campaign_plans")
    .select("*")
    .eq("id", planId)
    .maybeSingle();
  const plan = planRow as CampaignPlan | null;
  if (!plan) return { ok: false, error: "Plan not found." };
  if (!plan.smartlead_campaign_id) {
    return { ok: false, error: "Plan has no linked Smartlead campaign. Set one first." };
  }

  const { data: wsRow } = await supabase
    .from("workspace_settings")
    .select("smartlead_api_key")
    .eq("id", 1)
    .maybeSingle();
  const ws = wsRow as Pick<WorkspaceSettings, "smartlead_api_key"> | null;
  if (!ws?.smartlead_api_key) {
    return { ok: false, error: "Smartlead API key not set in Settings." };
  }

  // Only push leads that have been enriched (have an icebreaker).
  const { data: leadRows } = await supabase
    .from("leads")
    .select("*")
    .eq("campaign_plan_id", planId)
    .not("icebreaker", "is", null);
  const leads = (leadRows ?? []) as Lead[];
  if (leads.length === 0) {
    return { ok: false, error: "No enriched leads in this plan to push yet." };
  }

  const campaignId = Number(plan.smartlead_campaign_id);
  if (!Number.isFinite(campaignId)) {
    return { ok: false, error: "Linked Smartlead campaign id is invalid." };
  }

  const payload = leads.map((l) => {
    const [first, ...rest] = l.name.trim().split(/\s+/);
    return {
      first_name: first ?? "",
      last_name: rest.join(" ") || undefined,
      email: l.email,
      company_name: l.company ?? undefined,
      phone_number: l.phone ?? undefined,
      linkedin_profile: l.linkedin_url ?? undefined,
      custom_fields: {
        ...(l.subject_line ? { subject_line: l.subject_line } : {}),
        ...(l.icebreaker ? { icebreaker: l.icebreaker } : {}),
        ...(l.title ? { title: l.title } : {}),
      },
    };
  });

  let result;
  try {
    result = await addLeadsToCampaign(ws.smartlead_api_key, campaignId, payload);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  const now = new Date().toISOString();
  await supabase
    .from("leads")
    .update({
      email_status: "smartlead_sent",
      email_status_updated_at: now,
      smartlead_campaign_id: String(campaignId),
    })
    .in(
      "id",
      leads.map((l) => l.id),
    );

  await supabase.from("activity_log").insert(
    leads.map((l) => ({
      lead_id: l.id,
      user_id: user.id,
      action: `Pushed to Smartlead campaign ${campaignId} via plan "${plan.name}"`,
    })),
  );

  await supabase
    .from("campaign_plans")
    .update({ status: "pushed", updated_at: now })
    .eq("id", planId);

  revalidatePath("/", "layout");
  return {
    ok: true,
    pushed: result.upload_count ?? leads.length,
    already_in_campaign: result.already_added_to_campaign ?? 0,
    invalid_email_count: result.invalid_email_count ?? 0,
  };
}
