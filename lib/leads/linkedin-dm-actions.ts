"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  writeLinkedInDm,
  hasScrapedMaterial,
  type DmSource,
} from "@/lib/enrichment/linkedin-dm-writer";
import { getLeadValue } from "@/lib/leads-columns";
import {
  DM_BATCH_SIZE,
  EMPTY_USAGE,
  addUsage,
  type DmProgress,
  type TokenUsage,
} from "@/lib/leads/linkedin-dm";
import type { Lead } from "@/lib/types";

/** Keeps a stray value from the client turning into 500 parallel API calls. */
function clampBatchSize(n: number | undefined): number {
  if (!Number.isFinite(n)) return DM_BATCH_SIZE;
  return Math.max(1, Math.min(10, Math.floor(n as number)));
}

export interface DmPreflight {
  /** Leads that would be written in this run. */
  willWrite: number;
  /** Of those, how many have nothing scraped and will produce weak messages. */
  noMaterial: number;
}

/**
 * What a run is about to do, before any money is spent.
 *
 * The unscraped count is the important one: generating from an Apollo row
 * alone produces a message built from a job title and a firm name, which
 * reads exactly as thin as it sounds.
 */
export async function getDmPreflight(
  avatarId: string,
  runSize: number,
): Promise<DmPreflight> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select("website_summary, linkedin_summary, linkedin_posts_summary")
    .eq("avatar_id", avatarId)
    .eq("qualified", "qualified")
    .not("linkedin_url", "is", null)
    .is("linkedin_open_first", null)
    .is("linkedin_dm_status", null)
    .order("created_at", { ascending: true })
    .limit(runSize > 0 ? runSize : 1000);

  const rows = data ?? [];
  const has = (r: Record<string, unknown>, k: string) =>
    typeof r[k] === "string" && (r[k] as string).trim().length > 0;

  return {
    willWrite: rows.length,
    noMaterial: rows.filter(
      (r) =>
        !has(r, "website_summary") &&
        !has(r, "linkedin_summary") &&
        !has(r, "linkedin_posts_summary"),
    ).length,
  };
}

const SELECT = `id, name, title, company, raw_data, linkedin_url,
  website_summary, linkedin_summary, linkedin_posts_summary,
  linkedin_open_first, linkedin_dm_status, linkedin_dm_flag`;

export async function getDmProgress(avatarId: string): Promise<DmProgress> {
  const supabase = await createClient();

  const base = () =>
    supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("avatar_id", avatarId)
      .eq("qualified", "qualified")
      .not("linkedin_url", "is", null);

  const [{ count: total }, { count: written }, { count: failed }] = await Promise.all([
    base(),
    base().not("linkedin_open_first", "is", null),
    base().eq("linkedin_dm_status", "failed"),
  ]);

  const t = total ?? 0;
  const w = written ?? 0;
  const f = failed ?? 0;
  return { total: t, written: w, failed: f, remaining: Math.max(0, t - w - f) };
}

function toSource(lead: Lead): DmSource {
  return {
    name: lead.name,
    title: lead.title,
    company: lead.company,
    headline: getLeadValue(lead, "headline") || null,
    industry: getLeadValue(lead, "industry") || null,
    city: getLeadValue(lead, "city") || null,
    websiteSummary: lead.website_summary,
    linkedinSummary: lead.linkedin_summary,
    postsSummary: lead.linkedin_posts_summary,
  };
}

export interface BatchResult {
  processed: number;
  succeeded: number;
  failed: number;
  progress: DmProgress;
  /** Tokens this batch actually used, for the live cost figure. */
  usage: TokenUsage;
  /** First few failures, so a dry API key is obvious on the first round. */
  errors: { name: string; error: string }[];
  /** Set when nothing can proceed at all — stops the client looping pointlessly. */
  fatal?: string;
}

function emptyBatch(progress: DmProgress, fatal?: string): BatchResult {
  return {
    processed: 0,
    succeeded: 0,
    failed: 0,
    progress,
    usage: EMPTY_USAGE,
    errors: [],
    fatal,
  };
}

/**
 * Write the four openings for the next batch of leads in this avatar.
 *
 * Failed leads are NOT picked up again automatically. The enrichment pipeline
 * learned this the hard way: auto-retrying unenrichable leads starves the
 * queue and burns credit on rows that will never succeed. Use retryFailedDms
 * to deliberately have another go.
 */
export async function generateDmBatch(
  avatarId: string,
  batchSize?: number,
): Promise<BatchResult> {
  const size = clampBatchSize(batchSize);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return emptyBatch(await getDmProgress(avatarId), "Not authenticated.");
  }

  const { data: wsRow } = await supabase
    .from("workspace_settings")
    .select(
      "anthropic_api_key, linkedin_dm_prompt, linkedin_dm_template, linkedin_followup_1, linkedin_followup_2, linkedin_followup_3",
    )
    .eq("id", 1)
    .maybeSingle();

  const apiKey = wsRow?.anthropic_api_key as string | null;
  const rules = wsRow?.linkedin_dm_prompt as string | null;
  // The model is shown the fixed wording so each line runs on into it.
  const templates = {
    first: (wsRow?.linkedin_dm_template as string | null) ?? "",
    followup_1: (wsRow?.linkedin_followup_1 as string | null) ?? "",
    followup_2: (wsRow?.linkedin_followup_2 as string | null) ?? "",
    followup_3: (wsRow?.linkedin_followup_3 as string | null) ?? "",
  };

  const progressNow = await getDmProgress(avatarId);
  if (!apiKey) {
    return emptyBatch(progressNow, "No Anthropic API key saved in Settings.");
  }
  if (!rules || rules.trim().length === 0) {
    return emptyBatch(progressNow, "No LinkedIn writing rules saved in the LinkedIn lab.");
  }

  const { data, error } = await supabase
    .from("leads")
    .select(SELECT)
    .eq("avatar_id", avatarId)
    .eq("qualified", "qualified")
    .not("linkedin_url", "is", null)
    .is("linkedin_open_first", null)
    .is("linkedin_dm_status", null)
    .order("created_at", { ascending: true })
    .limit(size);

  if (error) return emptyBatch(progressNow, error.message);

  const batch = (data ?? []) as unknown as Lead[];
  if (batch.length === 0) return emptyBatch(progressNow);

  // Claim the batch so a second tab can't pick up the same rows.
  await supabase
    .from("leads")
    .update({ linkedin_dm_status: "generating" })
    .in("id", batch.map((l) => l.id));

  let succeeded = 0;
  let failed = 0;
  let usage = EMPTY_USAGE;
  const errors: { name: string; error: string }[] = [];

  const results = await Promise.allSettled(
    batch.map(async (lead) => {
      const source = toSource(lead);
      const result = await writeLinkedInDm(source, rules, templates, apiKey);
      return { lead, source, result };
    }),
  );

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    const lead = batch[i];

    if (r.status === "rejected") {
      failed++;
      const message =
        r.reason instanceof Error ? r.reason.message : String(r.reason);
      errors.push({ name: lead.name, error: message.slice(0, 200) });
      await supabase
        .from("leads")
        .update({
          linkedin_dm_status: "failed",
          linkedin_dm_error: message.slice(0, 500),
        })
        .eq("id", lead.id);
      continue;
    }

    const { source, result } = r.value;
    // Counted even if the database write below fails: the tokens were spent.
    usage = addUsage(usage, result.usage);

    // "thin" from the model, or simply nothing scraped to begin with — either
    // way it deserves a look before it goes out.
    const flag = !result.isAccountingFirm
      ? "not_accounting"
      : result.quality === "thin" || !hasScrapedMaterial(source)
        ? "thin"
        : null;

    const { error: writeErr } = await supabase
      .from("leads")
      .update({
        linkedin_open_first: result.first,
        linkedin_open_followup_1: result.followup_1,
        linkedin_open_followup_2: result.followup_2,
        linkedin_open_followup_3: result.followup_3,
        linkedin_dm_generated_at: new Date().toISOString(),
        linkedin_dm_status: "done",
        linkedin_dm_error: null,
        linkedin_dm_flag: flag,
      })
      .eq("id", lead.id);

    if (writeErr) {
      failed++;
      errors.push({ name: lead.name, error: writeErr.message.slice(0, 200) });
    } else {
      succeeded++;
    }
  }

  revalidatePath(`/avatars/${avatarId}/linkedin`);

  return {
    processed: batch.length,
    succeeded,
    failed,
    progress: await getDmProgress(avatarId),
    usage,
    errors: errors.slice(0, 3),
  };
}

/** Clear the failed marker so the next batch run picks these up again. */
export async function retryFailedDms(
  avatarId: string,
): Promise<{ reset: number } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data, error } = await supabase
    .from("leads")
    .update({ linkedin_dm_status: null, linkedin_dm_error: null })
    .eq("avatar_id", avatarId)
    .eq("linkedin_dm_status", "failed")
    .select("id");

  if (error) return { error: error.message };
  revalidatePath(`/avatars/${avatarId}/linkedin`);
  return { reset: (data ?? []).length };
}

/**
 * Release rows left mid-flight by a crashed or closed-tab run, so they aren't
 * stranded in 'generating' forever.
 */
export async function releaseStuckDms(avatarId: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("leads")
    .update({ linkedin_dm_status: null })
    .eq("avatar_id", avatarId)
    .eq("linkedin_dm_status", "generating")
    .is("linkedin_open_first", null);
}
