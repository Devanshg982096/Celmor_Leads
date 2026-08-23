"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  writeLinkedInDm,
  hasScrapedMaterial,
  type DmSource,
} from "@/lib/enrichment/linkedin-dm-writer";
import { startLeadScrape, pollLeadScrape } from "@/lib/enrichment/linkedin-scrape";
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

  const [
    { count: total },
    { count: written },
    { count: failed },
    { count: scraping },
    { count: readyToWrite },
  ] = await Promise.all([
    base(),
    base().not("linkedin_open_first", "is", null),
    base().eq("linkedin_dm_status", "failed"),
    base().eq("enrichment_status", "enriching"),
    // Has been read and is waiting on a message.
    base()
      .is("linkedin_open_first", null)
      .is("linkedin_dm_status", null)
      .not("linkedin_summary", "is", null),
  ]);

  const t = total ?? 0;
  const w = written ?? 0;
  const f = failed ?? 0;
  const s = scraping ?? 0;
  const r = readyToWrite ?? 0;
  const remaining = Math.max(0, t - w - f);

  return {
    total: t,
    written: w,
    failed: f,
    remaining,
    scraping: s,
    readyToWrite: r,
    needScrape: Math.max(0, remaining - s - r),
  };
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

export interface RunStepResult {
  /** Scrapes kicked off this pass. */
  scrapesStarted: number;
  /** Leads whose scrapes came back and were saved this pass. */
  scrapesFinished: number;
  written: number;
  failed: number;
  progress: DmProgress;
  usage: TokenUsage;
  apifyUsd: number;
  errors: { name: string; error: string }[];
  fatal?: string;
  /** False when there is genuinely nothing left to do. */
  workRemains: boolean;
}

const SCRAPE_SELECT = `id, name, title, company, raw_data, linkedin_url,
  website_summary, linkedin_summary, linkedin_posts_summary,
  website_run_id, linkedin_run_id, linkedin_posts_run_id,
  enrichment_status, enrichment_attempts, linkedin_open_first, linkedin_dm_status`;

/**
 * One slice of a run: collect finished scrapes, start new ones, write anything
 * that is ready.
 *
 * All three happen in the same call so the work pipelines. While one batch is
 * out at Apify being read, the previous batch is being written. Each call
 * stays short, which is what keeps a 388 lead run alive across a serverless
 * host's request timeout. The client repeats it until workRemains is false.
 */
export async function advanceDmRun(
  avatarId: string,
  batchSize?: number,
): Promise<RunStepResult> {
  const size = clampBatchSize(batchSize);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const empty = async (fatal?: string): Promise<RunStepResult> => ({
    scrapesStarted: 0,
    scrapesFinished: 0,
    written: 0,
    failed: 0,
    progress: await getDmProgress(avatarId),
    usage: EMPTY_USAGE,
    apifyUsd: 0,
    errors: [],
    fatal,
    workRemains: false,
  });

  if (!user) return empty("Not authenticated.");

  const { data: wsRow } = await supabase
    .from("workspace_settings")
    .select("apify_token, anthropic_api_key")
    .eq("id", 1)
    .maybeSingle();
  const token = wsRow?.apify_token as string | null;
  if (!token) return empty("No Apify token saved in Settings.");
  if (!wsRow?.anthropic_api_key) return empty("No Anthropic API key saved in Settings.");

  const scopeLeads = () =>
    supabase
      .from("leads")
      .select(SCRAPE_SELECT)
      .eq("avatar_id", avatarId)
      .eq("qualified", "qualified")
      .not("linkedin_url", "is", null);

  const errors: { name: string; error: string }[] = [];
  let apifyUsd = 0;
  let scrapesFinished = 0;
  let scrapesStarted = 0;

  // 1. Collect anything Apify has finished. Done first so those leads become
  //    writable in this same pass rather than waiting for the next one.
  const { data: inFlight } = await scopeLeads()
    .eq("enrichment_status", "enriching")
    .limit(size * 3);

  for (const row of (inFlight ?? []) as unknown as Lead[]) {
    try {
      const outcome = await pollLeadScrape(row, supabase, token);
      apifyUsd += outcome.costUsd;
      if (outcome.finished) scrapesFinished++;
    } catch (e) {
      errors.push({
        name: row.name,
        error: (e instanceof Error ? e.message : String(e)).slice(0, 200),
      });
    }
  }

  // 2. Start scrapes for leads that still have nothing, keeping about two
  //    batches in flight so Apify is always working while we write.
  const { count: nowScraping } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("avatar_id", avatarId)
    .eq("enrichment_status", "enriching");

  const room = Math.max(0, size * 2 - (nowScraping ?? 0));
  if (room > 0) {
    const { data: toScrape } = await scopeLeads()
      .is("linkedin_open_first", null)
      .is("linkedin_dm_status", null)
      .is("linkedin_summary", null)
      .is("enrichment_status", null)
      .order("created_at", { ascending: true })
      .limit(room);

    for (const row of (toScrape ?? []) as unknown as Lead[]) {
      const result = await startLeadScrape(row, supabase, token);
      if (result.started > 0) scrapesStarted++;
      else if (result.error) errors.push({ name: row.name, error: result.error });
    }
  }

  // 3. Write messages for anything that now has material.
  const batch = await generateDmBatch(avatarId, size);

  const progress = await getDmProgress(avatarId);
  const workRemains =
    progress.remaining > 0 &&
    (progress.needScrape > 0 || progress.scraping > 0 || progress.readyToWrite > 0);

  return {
    scrapesStarted,
    scrapesFinished,
    written: batch.succeeded,
    failed: batch.failed,
    progress,
    usage: batch.usage,
    apifyUsd,
    errors: [...errors, ...batch.errors].slice(0, 3),
    fatal: batch.fatal,
    workRemains,
  };
}

/**
 * Clear the messages on leads so the next run writes them again.
 *
 * Needed because the first leads through were written before their LinkedIn
 * had been read, so their messages are built from a job title alone. Without
 * this they would stay permanently worse than everything written after them.
 */
export async function rewriteDms(
  avatarId: string,
  scope: "all" | "flagged" | "unscraped",
): Promise<{ reset: number } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Deliberately a lookup followed by an update, rather than one filtered
  // update. Choosing between filter chains and then updating produces a union
  // of Supabase builder types deep enough that the compiler gives up with
  // "type instantiation is excessively deep". Each branch below is its own
  // complete, awaited query, so nothing has to be unified.
  const ids = await (async (): Promise<string[]> => {
    if (scope === "flagged") {
      const { data } = await supabase
        .from("leads")
        .select("id")
        .eq("avatar_id", avatarId)
        .not("linkedin_open_first", "is", null)
        .not("linkedin_dm_flag", "is", null);
      return (data ?? []).map((r) => r.id as string);
    }
    if (scope === "unscraped") {
      // Written before their LinkedIn was ever read: the ones worth redoing.
      const { data } = await supabase
        .from("leads")
        .select("id")
        .eq("avatar_id", avatarId)
        .not("linkedin_open_first", "is", null)
        .is("linkedin_summary", null);
      return (data ?? []).map((r) => r.id as string);
    }
    const { data } = await supabase
      .from("leads")
      .select("id")
      .eq("avatar_id", avatarId)
      .not("linkedin_open_first", "is", null);
    return (data ?? []).map((r) => r.id as string);
  })();

  if (ids.length === 0) return { reset: 0 };

  const { error } = await supabase
    .from("leads")
    .update({
      linkedin_open_first: null,
      linkedin_open_followup_1: null,
      linkedin_open_followup_2: null,
      linkedin_open_followup_3: null,
      linkedin_dm_status: null,
      linkedin_dm_error: null,
      linkedin_dm_flag: null,
      linkedin_dm_generated_at: null,
    })
    .in("id", ids);
  if (error) return { error: error.message };

  revalidatePath(`/avatars/${avatarId}/linkedin`);
  return { reset: ids.length };
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
