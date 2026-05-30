"use server";

import { createClient } from "@/lib/supabase/server";
import type { Lead, WorkspaceSettings } from "@/lib/types";
import {
  addLeadsToCampaign,
  createCampaign,
  getAnalytics,
  getSequence,
  listCampaigns,
  saveSequence,
  type AddLeadsResult,
  type SequenceStepInput,
  type SmartleadAnalytics,
  type SmartleadCampaign,
  type SmartleadLead,
  type SmartleadSequenceStep,
} from "./client";
import { plainToSmartleadHtml, smartleadHtmlToPlain } from "./html";

async function getApiKey(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspace_settings")
    .select("smartlead_api_key")
    .eq("id", 1)
    .maybeSingle();
  const ws = data as Pick<WorkspaceSettings, "smartlead_api_key"> | null;
  return ws?.smartlead_api_key ?? null;
}

export async function listCampaignsAction(): Promise<
  | { ok: true; campaigns: SmartleadCampaign[] }
  | { ok: false; error: string }
> {
  const apiKey = await getApiKey();
  if (!apiKey) return { ok: false, error: "Smartlead API key not set in Settings." };
  try {
    const campaigns = await listCampaigns(apiKey);
    return { ok: true, campaigns };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function createCampaignAction(
  name: string,
): Promise<
  | { ok: true; campaign: SmartleadCampaign }
  | { ok: false; error: string }
> {
  const trimmed = name.trim();
  if (trimmed.length === 0) return { ok: false, error: "Campaign name is required." };
  const apiKey = await getApiKey();
  if (!apiKey) return { ok: false, error: "Smartlead API key not set in Settings." };
  try {
    const campaign = await createCampaign(apiKey, trimmed);
    return { ok: true, campaign };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function saveSequenceAction(
  campaignId: number,
  steps: SequenceStepInput[],
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (steps.length === 0) {
    return { ok: false, error: "Sequence must have at least one step." };
  }
  for (const [i, s] of steps.entries()) {
    if (!s.subject.trim() && i === 0) {
      return { ok: false, error: "Step 1 subject is required." };
    }
    if (!s.email_body.trim()) {
      return { ok: false, error: `Step ${i + 1} body is empty.` };
    }
  }
  const apiKey = await getApiKey();
  if (!apiKey) return { ok: false, error: "Smartlead API key not set in Settings." };
  try {
    // Convert plain-text bodies to Smartlead's expected HTML before sending.
    const htmlSteps = steps.map((s) => ({
      ...s,
      email_body: plainToSmartleadHtml(s.email_body),
    }));
    await saveSequence(apiKey, campaignId, htmlSteps);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function getCampaignDetailAction(
  campaignId: number,
): Promise<
  | {
      ok: true;
      sequence: SmartleadSequenceStep[];
      analytics: SmartleadAnalytics;
    }
  | { ok: false; error: string }
> {
  const apiKey = await getApiKey();
  if (!apiKey) return { ok: false, error: "Smartlead API key not set in Settings." };
  try {
    const [sequenceRaw, analytics] = await Promise.all([
      getSequence(apiKey, campaignId),
      getAnalytics(apiKey, campaignId).catch(() => ({}) as SmartleadAnalytics),
    ]);
    // Decode Smartlead's HTML body so the textarea editor shows plain text.
    const sequence = sequenceRaw.map((s) => ({
      ...s,
      email_body: s.email_body ? smartleadHtmlToPlain(s.email_body) : s.email_body,
    }));
    return { ok: true, sequence, analytics };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

interface PushResultPerLead {
  lead_id: string;
  email: string;
  status: "ok" | "skipped" | "failed";
  reason?: string;
}

export async function pushLeadsToCampaignAction(
  campaignId: number,
  leadIds: string[],
): Promise<
  | {
      ok: true;
      campaignId: number;
      upload_count: number;
      already_in_campaign: number;
      invalid_email_count: number;
      per_lead: PushResultPerLead[];
    }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const apiKey = await getApiKey();
  if (!apiKey) return { ok: false, error: "Smartlead API key not set in Settings." };

  if (leadIds.length === 0) return { ok: false, error: "No leads selected." };

  const { data: leadRows, error: leadErr } = await supabase
    .from("leads")
    .select("*")
    .in("id", leadIds);
  if (leadErr) return { ok: false, error: leadErr.message };
  const leads = (leadRows ?? []) as Lead[];

  const perLead: PushResultPerLead[] = [];
  const payload: SmartleadLead[] = [];
  const leadByEmail = new Map<string, Lead>();

  for (const lead of leads) {
    if (!lead.email) {
      perLead.push({ lead_id: lead.id, email: "", status: "skipped", reason: "no email" });
      continue;
    }
    const [first, ...rest] = lead.name.trim().split(/\s+/);
    payload.push({
      first_name: first ?? "",
      last_name: rest.join(" ") || undefined,
      email: lead.email,
      company_name: lead.company ?? undefined,
      phone_number: lead.phone ?? undefined,
      linkedin_profile: lead.linkedin_url ?? undefined,
      custom_fields: {
        ...(lead.subject_line ? { subject_line: lead.subject_line } : {}),
        ...(lead.icebreaker ? { icebreaker: lead.icebreaker } : {}),
        ...(lead.title ? { title: lead.title } : {}),
      },
    });
    leadByEmail.set(lead.email.toLowerCase(), lead);
  }

  if (payload.length === 0) {
    return { ok: false, error: "All selected leads were skipped (no emails)." };
  }

  let result: AddLeadsResult;
  try {
    result = await addLeadsToCampaign(apiKey, campaignId, payload);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }

  // Mark each lead pushed as smartlead_sent and tag the campaign id so we can
  // sync status back later. Smartlead doesn't return per-lead success/failure
  // for the batch, so we apply the same status to all leads we sent.
  const now = new Date().toISOString();
  const pushedIds = payload
    .map((p) => leadByEmail.get(p.email.toLowerCase())?.id)
    .filter((id): id is string => !!id);

  if (pushedIds.length > 0) {
    await supabase
      .from("leads")
      .update({
        email_status: "smartlead_sent",
        email_status_updated_at: now,
        smartlead_campaign_id: String(campaignId),
      })
      .in("id", pushedIds);

    await supabase.from("activity_log").insert(
      pushedIds.map((id) => ({
        lead_id: id,
        user_id: user.id,
        action: `Pushed to Smartlead campaign ${campaignId}`,
      })),
    );
    for (const id of pushedIds) {
      perLead.push({
        lead_id: id,
        email: leads.find((l) => l.id === id)?.email ?? "",
        status: "ok",
      });
    }
  }

  return {
    ok: true,
    campaignId,
    upload_count: result.upload_count ?? pushedIds.length,
    already_in_campaign: result.already_added_to_campaign ?? 0,
    invalid_email_count: result.invalid_email_count ?? 0,
    per_lead: perLead,
  };
}
