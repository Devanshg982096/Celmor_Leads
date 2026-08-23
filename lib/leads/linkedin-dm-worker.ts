import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
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

/**
 * The actual run logic, taking a Supabase client rather than creating one.
 *
 * Lives apart from the server actions so the same code can run two ways: as
 * the browser's loop, using the signed-in user's client, and as the scheduled
 * worker, using the service-role client with no session at all. Duplicating it
 * would guarantee the two drift.
 */

type Client = SupabaseClient;

/** Keeps a stray value from turning into hundreds of parallel API calls. */
export function clampBatchSize(n: number | undefined): number {
  if (!Number.isFinite(n)) return DM_BATCH_SIZE;
  return Math.max(1, Math.min(10, Math.floor(n as number)));
}

const SCRAPE_SELECT = `id, name, title, company, raw_data, linkedin_url,
  website_summary, linkedin_summary, linkedin_posts_summary,
  website_run_id, linkedin_run_id, linkedin_posts_run_id,
  enrichment_status, enrichment_attempts, linkedin_open_first, linkedin_dm_status`;

export async function getProgressFor(
  avatarId: string,
  client: Client,
): Promise<DmProgress> {
  const base = () =>
    client
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

export interface WriteOutcome {
  succeeded: number;
  failed: number;
  usage: TokenUsage;
  errors: { name: string; error: string }[];
  fatal?: string;
}

/** Write messages for the next few leads that already have material. */
export async function writeDmBatchFor(
  avatarId: string,
  size: number,
  client: Client,
): Promise<WriteOutcome> {
  const empty: WriteOutcome = { succeeded: 0, failed: 0, usage: EMPTY_USAGE, errors: [] };

  const { data: wsRow } = await client
    .from("workspace_settings")
    .select(
      "anthropic_api_key, linkedin_dm_prompt, linkedin_dm_template, linkedin_followup_1, linkedin_followup_2, linkedin_followup_3",
    )
    .eq("id", 1)
    .maybeSingle();

  const apiKey = wsRow?.anthropic_api_key as string | null;
  const rules = wsRow?.linkedin_dm_prompt as string | null;
  if (!apiKey) return { ...empty, fatal: "No Anthropic API key saved in Settings." };
  if (!rules?.trim()) {
    return { ...empty, fatal: "No LinkedIn writing rules saved in the LinkedIn lab." };
  }

  const templates = {
    first: (wsRow?.linkedin_dm_template as string | null) ?? "",
    followup_1: (wsRow?.linkedin_followup_1 as string | null) ?? "",
    followup_2: (wsRow?.linkedin_followup_2 as string | null) ?? "",
    followup_3: (wsRow?.linkedin_followup_3 as string | null) ?? "",
  };

  const { data, error } = await client
    .from("leads")
    .select(SCRAPE_SELECT)
    .eq("avatar_id", avatarId)
    .eq("qualified", "qualified")
    .not("linkedin_url", "is", null)
    .is("linkedin_open_first", null)
    .is("linkedin_dm_status", null)
    .not("linkedin_summary", "is", null)
    .order("created_at", { ascending: true })
    .limit(size);

  if (error) return { ...empty, fatal: error.message };

  const batch = (data ?? []) as unknown as Lead[];
  if (batch.length === 0) return empty;

  // Claim the rows before any work, so the browser loop and the scheduled
  // worker running at the same moment cannot both write the same lead.
  await client
    .from("leads")
    .update({ linkedin_dm_status: "generating" })
    .in(
      "id",
      batch.map((l) => l.id),
    );

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
      const message = r.reason instanceof Error ? r.reason.message : String(r.reason);
      errors.push({ name: lead.name, error: message.slice(0, 200) });
      await client
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

    const flag = !result.isAccountingFirm
      ? "not_accounting"
      : result.quality === "thin" || !hasScrapedMaterial(source)
        ? "thin"
        : null;

    const { error: writeErr } = await client
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

  return { succeeded, failed, usage, errors };
}

export interface RunStepResult {
  scrapesStarted: number;
  scrapesFinished: number;
  written: number;
  failed: number;
  progress: DmProgress;
  usage: TokenUsage;
  apifyUsd: number;
  errors: { name: string; error: string }[];
  fatal?: string;
  workRemains: boolean;
}

/**
 * One slice of a run: collect finished scrapes, start new ones, write anything
 * that is ready.
 *
 * All three happen in the same call so the work pipelines. While one batch is
 * out at Apify being read, the previous batch is being written. Each call
 * stays short, which is what lets both the browser and a scheduled worker
 * drive it without any single request running long.
 */
export async function advanceDmRunFor(
  avatarId: string,
  batchSize: number,
  client: Client,
): Promise<RunStepResult> {
  const size = clampBatchSize(batchSize);

  const empty = async (fatal?: string): Promise<RunStepResult> => ({
    scrapesStarted: 0,
    scrapesFinished: 0,
    written: 0,
    failed: 0,
    progress: await getProgressFor(avatarId, client),
    usage: EMPTY_USAGE,
    apifyUsd: 0,
    errors: [],
    fatal,
    workRemains: false,
  });

  const { data: wsRow } = await client
    .from("workspace_settings")
    .select("apify_token, anthropic_api_key")
    .eq("id", 1)
    .maybeSingle();
  const token = wsRow?.apify_token as string | null;
  if (!token) return empty("No Apify token saved in Settings.");
  if (!wsRow?.anthropic_api_key) return empty("No Anthropic API key saved in Settings.");

  const scopeLeads = () =>
    client
      .from("leads")
      .select(SCRAPE_SELECT)
      .eq("avatar_id", avatarId)
      .eq("qualified", "qualified")
      .not("linkedin_url", "is", null);

  const errors: { name: string; error: string }[] = [];
  let apifyUsd = 0;
  let scrapesFinished = 0;
  let scrapesStarted = 0;

  // 1. Collect anything Apify has finished, first, so those leads become
  //    writable in this same pass rather than waiting for the next one.
  const { data: inFlight } = await scopeLeads()
    .eq("enrichment_status", "enriching")
    .limit(size * 3);

  for (const row of (inFlight ?? []) as unknown as Lead[]) {
    try {
      const outcome = await pollLeadScrape(row, client, token);
      apifyUsd += outcome.costUsd;
      if (outcome.finished) scrapesFinished++;
    } catch (e) {
      errors.push({
        name: row.name,
        error: (e instanceof Error ? e.message : String(e)).slice(0, 200),
      });
    }
  }

  // 2. Start scrapes for leads with nothing, keeping about two batches in
  //    flight so Apify is always working while we write.
  const { count: nowScraping } = await client
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
      const result = await startLeadScrape(row, client, token);
      if (result.started > 0) scrapesStarted++;
      else if (result.error) errors.push({ name: row.name, error: result.error });
    }
  }

  // 3. Write messages for anything that now has material.
  const batch = await writeDmBatchFor(avatarId, size, client);

  const progress = await getProgressFor(avatarId, client);
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
