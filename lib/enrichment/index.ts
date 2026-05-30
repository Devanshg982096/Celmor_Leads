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
  const linkedinUrl = lead.linkedin_url;

  try {
    const [websiteSummary, linkedinSummary] = await Promise.all([
      scrapeWebsite(websiteUrl, ws.apify_token).catch((e) => {
        console.error("[enrich] website crawl failed", leadId, e);
        return null;
      }),
      scrapeLinkedIn(linkedinUrl, ws.apify_token).catch((e) => {
        console.error("[enrich] linkedin scrape failed", leadId, e);
        return null;
      }),
    ]);

    if (!websiteSummary && !linkedinSummary) {
      return finalize(client, leadId, "No website or LinkedIn data available");
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

/**
 * Resolve a usable website URL for a lead. Prefer the canonical `website`
 * key (mapped from Apollo's "Company Website Full"), then fall back to the
 * short variant. Both live in raw_data for non-canonical leads.
 */
function pickWebsite(lead: Lead): string | null {
  const raw = lead.raw_data ?? {};
  const candidates: unknown[] = [raw.website, raw.company_website_short];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) return c.trim();
  }
  return null;
}
