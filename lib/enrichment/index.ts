import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Lead, WorkspaceSettings } from "@/lib/types";
import { scrapeWebsite } from "./website";
import { scrapeLinkedIn } from "./linkedin";
import { generateIcebreaker } from "./claude";

// The codebase uses the un-parametrized SupabaseClient (see lib/leads/actions.ts);
// matching that keeps the `.update(...)` types from collapsing to `never`.
type Client = SupabaseClient;

interface EnrichResult {
  ok: true;
  subject: string;
  icebreaker: string;
}

interface EnrichError {
  ok: false;
  error: string;
}

/**
 * Run the full enrichment pipeline for one lead:
 *   1. Crawl website (Apify website-content-crawler)
 *   2. Scrape LinkedIn profile (Apify dev_fusion)
 *   3. Generate {subject, icebreaker} via Claude using the workspace prompt
 *
 * Steps 1 & 2 run in parallel. Either may return null (no source URL or empty
 * result); Claude is still called as long as we have at least one of them.
 *
 * Persists results + status to the leads row. The caller is responsible for
 * providing a Supabase client with permission to update the row (user context
 * for on-demand, service role for the cron).
 */
export async function enrichLead(
  leadId: string,
  client: Client,
): Promise<EnrichResult | EnrichError> {
  const { data: leadRaw, error: leadErr } = await client
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .maybeSingle();
  if (leadErr || !leadRaw) {
    return { ok: false, error: leadErr?.message ?? "Lead not found" };
  }
  const lead = leadRaw as Lead;

  const { data: wsRaw } = await client
    .from("workspace_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  const ws = wsRaw as WorkspaceSettings | null;
  if (!ws?.apify_token) return finalize(client, leadId, "Apify token not set in Settings");
  if (!ws.anthropic_api_key) return finalize(client, leadId, "Anthropic key not set in Settings");

  // Mark enriching
  await client
    .from("leads")
    .update({ enrichment_status: "enriching", enrichment_error: null })
    .eq("id", leadId);

  const websiteUrl = pickWebsite(lead);
  const linkedinUrl = pickLinkedIn(lead);

  try {
    const [websiteRes, linkedinRes] = await Promise.all([
      runStep("website", websiteUrl, () =>
        scrapeWebsite(websiteUrl, ws.apify_token!),
      ),
      runStep("linkedin", linkedinUrl, () =>
        scrapeLinkedIn(linkedinUrl, ws.apify_token!),
      ),
    ]);

    const websiteSummary = websiteRes.summary;
    const linkedinSummary = linkedinRes.summary;

    if (!websiteSummary && !linkedinSummary) {
      // Build a specific reason so the user knows *why* both failed.
      const reasons: string[] = [];
      reasons.push(`website: ${websiteRes.reason}`);
      reasons.push(`linkedin: ${linkedinRes.reason}`);
      return finalize(client, leadId, `Both sources empty — ${reasons.join("; ")}`);
    }

    const { subject, icebreaker } = await generateIcebreaker(
      {
        name: lead.name,
        title: lead.title,
        company: lead.company,
        websiteSummary,
        linkedinSummary,
      },
      ws.icebreaker_prompt,
      ws.anthropic_api_key,
    );

    const now = new Date().toISOString();
    const { error: updateErr } = await client
      .from("leads")
      .update({
        website_summary: websiteSummary,
        linkedin_summary: linkedinSummary,
        subject_line: subject,
        icebreaker,
        enriched_at: now,
        enrichment_status: "done",
        enrichment_error: null,
      })
      .eq("id", leadId);
    if (updateErr) return finalize(client, leadId, updateErr.message);

    return { ok: true, subject, icebreaker };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown enrichment error";
    return finalize(client, leadId, msg);
  }
}

async function finalize(
  client: Client,
  leadId: string,
  errorMsg: string,
): Promise<EnrichError> {
  await client
    .from("leads")
    .update({ enrichment_status: "failed", enrichment_error: errorMsg })
    .eq("id", leadId);
  return { ok: false, error: errorMsg };
}

interface StepResult {
  summary: string | null;
  reason: string;
}

async function runStep(
  label: string,
  url: string | null,
  fn: () => Promise<string | null>,
): Promise<StepResult> {
  if (!url) return { summary: null, reason: "no URL on lead" };
  try {
    const summary = await fn();
    if (!summary) return { summary: null, reason: "scraper returned empty" };
    return { summary, reason: "ok" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[enrich] ${label} step failed`, msg);
    // Truncate so a giant API error doesn't blow the DB column.
    return { summary: null, reason: msg.slice(0, 240) };
  }
}

/**
 * Resolve a usable website URL for a lead. Tries every known key both as a
 * canonical column and inside raw_data.
 */
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

/**
 * Resolve a usable LinkedIn profile URL. Prefer the canonical column,
 * then fall back to common raw_data keys.
 */
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
