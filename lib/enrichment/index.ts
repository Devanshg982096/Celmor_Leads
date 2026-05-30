import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Lead, WorkspaceSettings } from "@/lib/types";
import {
  getRun,
  getDatasetItems,
  isTerminal,
  startRun,
  type ApifyRunMeta,
} from "./apify";
import {
  WEBSITE_ACTOR_ID,
  buildWebsiteInput,
  summariseWebsiteItems,
  type ApifyWebsiteItem,
} from "./website";
import {
  LINKEDIN_ACTOR_ID,
  buildLinkedInInput,
  summariseLinkedInItems,
  type LinkedInProfile,
} from "./linkedin";
import { generateIcebreaker } from "./claude";

// Codebase uses the un-parametrized SupabaseClient (see lib/leads/actions.ts).
type Client = SupabaseClient;

export interface StartResult {
  ok: true;
  status: "enriching" | "done";
  subject?: string;
  icebreaker?: string;
}

export interface PipelineError {
  ok: false;
  error: string;
}

/**
 * Kick off enrichment. Starts the two Apify runs (which return immediately
 * with run IDs), saves the run IDs on the lead, sets status='enriching'.
 * Caller polls via finalizeEnrichment until status flips to 'done' or 'failed'.
 *
 * Returns quickly enough to live inside a Netlify Server Action's timeout.
 */
export async function startEnrichment(
  leadId: string,
  client: Client,
): Promise<StartResult | PipelineError> {
  const lead = await fetchLead(client, leadId);
  if (!lead) return { ok: false, error: "Lead not found" };

  const ws = await fetchSettings(client);
  if (!ws?.apify_token) return finalize(client, leadId, "Apify token not set in Settings");
  if (!ws.anthropic_api_key) return finalize(client, leadId, "Anthropic key not set in Settings");

  const websiteUrl = pickWebsite(lead);
  const linkedinUrl = pickLinkedIn(lead);
  if (!websiteUrl && !linkedinUrl) {
    return finalize(client, leadId, "Lead has neither a website nor a LinkedIn URL");
  }

  // Kick off both runs in parallel. Each call returns in <2s with a run id.
  const [websiteStart, linkedinStart] = await Promise.all([
    websiteUrl
      ? startRun(WEBSITE_ACTOR_ID, buildWebsiteInput(websiteUrl), ws.apify_token).catch(
          (e) => ({ error: e instanceof Error ? e.message : String(e) }),
        )
      : Promise.resolve(null),
    linkedinUrl
      ? startRun(LINKEDIN_ACTOR_ID, buildLinkedInInput(linkedinUrl), ws.apify_token).catch(
          (e) => ({ error: e instanceof Error ? e.message : String(e) }),
        )
      : Promise.resolve(null),
  ]);

  const websiteRunId = isRun(websiteStart) ? websiteStart.id : null;
  const linkedinRunId = isRun(linkedinStart) ? linkedinStart.id : null;

  // If both attempts errored at start, surface the upstream errors immediately.
  if (!websiteRunId && !linkedinRunId) {
    const reasons: string[] = [];
    if (websiteUrl && websiteStart && "error" in websiteStart) reasons.push(`website: ${websiteStart.error}`);
    if (linkedinUrl && linkedinStart && "error" in linkedinStart) reasons.push(`linkedin: ${linkedinStart.error}`);
    return finalize(client, leadId, `Could not start any Apify run — ${reasons.join("; ")}`);
  }

  await client
    .from("leads")
    .update({
      enrichment_status: "enriching",
      enrichment_error: null,
      enrichment_started_at: new Date().toISOString(),
      website_run_id: websiteRunId,
      linkedin_run_id: linkedinRunId,
      // Keep prior results around until we have fresh ones.
    })
    .eq("id", leadId);

  return { ok: true, status: "enriching" };
}

/**
 * Poll Apify for run status; once both runs are terminal, fetch results,
 * call Claude, and write the final result.
 *
 * Safe to call repeatedly — no-ops if the runs aren't done yet, and idempotent
 * if the row has already reached a terminal state.
 */
export async function finalizeEnrichment(
  leadId: string,
  client: Client,
): Promise<StartResult | PipelineError> {
  const lead = await fetchLead(client, leadId);
  if (!lead) return { ok: false, error: "Lead not found" };

  // Nothing to poll for if we never entered enriching, or we already finished.
  if (lead.enrichment_status === "done") {
    return {
      ok: true,
      status: "done",
      subject: lead.subject_line ?? undefined,
      icebreaker: lead.icebreaker ?? undefined,
    };
  }
  if (lead.enrichment_status !== "enriching") {
    return { ok: false, error: `Lead is not enriching (status=${lead.enrichment_status ?? "null"})` };
  }

  const ws = await fetchSettings(client);
  if (!ws?.apify_token) return finalize(client, leadId, "Apify token not set in Settings");
  if (!ws.anthropic_api_key) return finalize(client, leadId, "Anthropic key not set in Settings");

  const [websiteRun, linkedinRun] = await Promise.all([
    lead.website_run_id ? getRun(lead.website_run_id, ws.apify_token).catch(toErrorMeta) : null,
    lead.linkedin_run_id ? getRun(lead.linkedin_run_id, ws.apify_token).catch(toErrorMeta) : null,
  ]);

  // If either run is still in progress, do nothing. The next poll will check again.
  const websiteDone = websiteRun === null || isTerminalMeta(websiteRun);
  const linkedinDone = linkedinRun === null || isTerminalMeta(linkedinRun);
  if (!websiteDone || !linkedinDone) {
    return { ok: true, status: "enriching" };
  }

  // Both terminal — fetch items from whichever succeeded.
  const websiteSummary = await fetchSummary(
    websiteRun,
    ws.apify_token,
    (items: ApifyWebsiteItem[]) => summariseWebsiteItems(items),
  );
  const linkedinSummary = await fetchSummary(
    linkedinRun,
    ws.apify_token,
    (items: LinkedInProfile[]) => summariseLinkedInItems(items),
  );

  if (!websiteSummary.summary && !linkedinSummary.summary) {
    const reasons = [
      `website: ${websiteSummary.reason}`,
      `linkedin: ${linkedinSummary.reason}`,
    ];
    return finalize(client, leadId, `Both sources empty — ${reasons.join("; ")}`);
  }

  try {
    const { subject, icebreaker } = await generateIcebreaker(
      {
        name: lead.name,
        title: lead.title,
        company: lead.company,
        websiteSummary: websiteSummary.summary,
        linkedinSummary: linkedinSummary.summary,
      },
      ws.icebreaker_prompt,
      ws.anthropic_api_key,
    );

    const now = new Date().toISOString();
    const { error: updateErr } = await client
      .from("leads")
      .update({
        website_summary: websiteSummary.summary,
        linkedin_summary: linkedinSummary.summary,
        subject_line: subject,
        icebreaker,
        enriched_at: now,
        enrichment_status: "done",
        enrichment_error: null,
        website_run_id: null,
        linkedin_run_id: null,
      })
      .eq("id", leadId);
    if (updateErr) return finalize(client, leadId, updateErr.message);

    return { ok: true, status: "done", subject, icebreaker };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown enrichment error";
    return finalize(client, leadId, msg);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchLead(client: Client, leadId: string): Promise<Lead | null> {
  const { data } = await client
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .maybeSingle();
  return (data as Lead | null) ?? null;
}

async function fetchSettings(client: Client): Promise<WorkspaceSettings | null> {
  const { data } = await client
    .from("workspace_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  return (data as WorkspaceSettings | null) ?? null;
}

async function finalize(
  client: Client,
  leadId: string,
  errorMsg: string,
): Promise<PipelineError> {
  await client
    .from("leads")
    .update({
      enrichment_status: "failed",
      enrichment_error: errorMsg,
      website_run_id: null,
      linkedin_run_id: null,
    })
    .eq("id", leadId);
  return { ok: false, error: errorMsg };
}

type StartOutcome = ApifyRunMeta | { error: string } | null;

function isRun(x: StartOutcome): x is ApifyRunMeta {
  return !!x && "id" in x;
}

type RunMetaOrError = ApifyRunMeta | { error: string };

function toErrorMeta(e: unknown): { error: string } {
  return { error: e instanceof Error ? e.message : String(e) };
}

function isTerminalMeta(m: RunMetaOrError): boolean {
  if ("error" in m) return true; // treat fetch errors as terminal failure
  return isTerminal(m.status);
}

interface SummaryResult {
  summary: string | null;
  reason: string;
}

async function fetchSummary<T>(
  meta: RunMetaOrError | null,
  token: string,
  summarise: (items: T[]) => string | null,
): Promise<SummaryResult> {
  if (meta === null) return { summary: null, reason: "no URL on lead" };
  if ("error" in meta) return { summary: null, reason: `poll failed: ${meta.error.slice(0, 200)}` };
  if (meta.status !== "SUCCEEDED") {
    return { summary: null, reason: `Apify run ${meta.status.toLowerCase()}` };
  }
  try {
    const items = await getDatasetItems<T>(meta.defaultDatasetId, token);
    const summary = summarise(items);
    return summary
      ? { summary, reason: "ok" }
      : { summary: null, reason: "scraper returned empty" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { summary: null, reason: `dataset fetch failed: ${msg.slice(0, 200)}` };
  }
}

function pickWebsite(lead: Lead): string | null {
  const raw = lead.raw_data ?? {};
  const candidates: unknown[] = [
    raw.website,
    raw.company_website_short,
    raw.company_website_full,
    raw["Website"],
    raw["Company Website Full"],
    raw["Company Website Short"],
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) return c.trim();
  }
  return null;
}

function pickLinkedIn(lead: Lead): string | null {
  if (lead.linkedin_url && lead.linkedin_url.trim().length > 0) {
    return lead.linkedin_url.trim();
  }
  const raw = lead.raw_data ?? {};
  const candidates: unknown[] = [
    raw.linkedin_url,
    raw["Person Linkedin Url"],
    raw["Person LinkedIn URL"],
    raw["LinkedIn URL"],
    raw["Linkedin URL"],
    raw["LinkedIn Profile"],
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) return c.trim();
  }
  return null;
}
