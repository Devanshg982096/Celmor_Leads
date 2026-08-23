import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Lead } from "@/lib/types";
import { getRun, getDatasetItems, isTerminal, startRun } from "./apify";
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
import {
  LINKEDIN_POSTS_ACTOR_ID,
  buildLinkedInPostsInput,
  summariseLinkedInPosts,
  type LinkedInPost,
} from "./linkedin-posts";

type Client = SupabaseClient;

/**
 * Scraping for the LinkedIn DM flow.
 *
 * Deliberately separate from lib/enrichment/index.ts, which does the same
 * three scrapes AND then calls Claude to write an email icebreaker. That extra
 * call is pure waste here: the DM flow writes its own messages later from the
 * same material, so paying for an icebreaker nobody reads would roughly double
 * the AI cost of a run.
 */

/** Where the lead's website lives, across the various Apollo column names. */
export function pickWebsite(lead: Lead): string | null {
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

export function pickLinkedIn(lead: Lead): string | null {
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

/**
 * Is this Apify saying something is wrong with the ACCOUNT, rather than with
 * this particular lead?
 *
 * The distinction matters a lot. A lead-level failure means skip it and carry
 * on; an account-level one means every remaining lead will fail identically.
 * Treating "monthly usage hard limit exceeded" as a per-lead problem marked
 * 165 leads permanently broken in one run, none of which had anything wrong
 * with them.
 */
export function isAccountLevelApifyError(message: string): boolean {
  return /hard limit exceeded|platform-feature-disabled|monthly usage|usage limit|payment|insufficient credit|401|403|unauthorized|invalid token|account.*(disabled|suspended)/i.test(
    message,
  );
}

/** True when there is nothing left worth scraping for this lead. */
export function hasAllMaterial(lead: Lead): boolean {
  const has = (v: string | null) => typeof v === "string" && v.trim().length > 0;
  const wantsWebsite = pickWebsite(lead) !== null;
  return (
    has(lead.linkedin_summary) &&
    has(lead.linkedin_posts_summary) &&
    (!wantsWebsite || has(lead.website_summary))
  );
}

/**
 * Kick off the scrapes this lead is still missing and record the run ids.
 *
 * Returns immediately — each start call comes back in a second or two with a
 * run id, and the actual scraping happens on Apify's side. Nothing here waits.
 */
export async function startLeadScrape(
  lead: Lead,
  client: Client,
  token: string,
): Promise<{ started: number; error?: string; accountError?: string }> {
  const linkedinUrl = pickLinkedIn(lead);
  const websiteUrl = pickWebsite(lead);

  const filled = (v: string | null) => typeof v === "string" && v.trim().length > 0;
  const needProfile = !!linkedinUrl && !filled(lead.linkedin_summary);
  const needPosts = !!linkedinUrl && !filled(lead.linkedin_posts_summary);
  const needWebsite = !!websiteUrl && !filled(lead.website_summary);

  if (!needProfile && !needPosts && !needWebsite) {
    return { started: 0, error: linkedinUrl ? undefined : "No LinkedIn URL on this lead" };
  }

  const safeStart = async (fn: () => Promise<{ id: string }>) => {
    try {
      return await fn();
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  };

  const [profile, posts, website] = await Promise.all([
    needProfile
      ? safeStart(() => startRun(LINKEDIN_ACTOR_ID, buildLinkedInInput(linkedinUrl!), token))
      : Promise.resolve(null),
    needPosts
      ? safeStart(() =>
          startRun(LINKEDIN_POSTS_ACTOR_ID, buildLinkedInPostsInput(linkedinUrl!), token),
        )
      : Promise.resolve(null),
    needWebsite
      ? safeStart(() => startRun(WEBSITE_ACTOR_ID, buildWebsiteInput(websiteUrl!), token))
      : Promise.resolve(null),
  ]);

  const idOf = (r: unknown) =>
    r && typeof r === "object" && "id" in r ? (r as { id: string }).id : null;

  const profileId = idOf(profile);
  const postsId = idOf(posts);
  const websiteId = idOf(website);
  const started = [profileId, postsId, websiteId].filter(Boolean).length;

  if (started === 0) {
    const reasons = [profile, posts, website]
      .filter((r) => r && typeof r === "object" && "error" in r)
      .map((r) => (r as { error: string }).error);
    const first = reasons[0] ?? "";

    // The account is blocked, so this lead is fine and every other lead would
    // fail the same way. Leave the row completely untouched and let the caller
    // stop the run: marking it failed would blame the lead for a billing
    // setting, and it would then need clearing by hand afterwards.
    if (isAccountLevelApifyError(first)) {
      return { started: 0, accountError: first.slice(0, 300) };
    }

    const message = `Could not start any scrape${first ? `: ${first}` : ""}`;
    await client
      .from("leads")
      .update({ enrichment_status: "failed", enrichment_error: message.slice(0, 500) })
      .eq("id", lead.id);
    return { started: 0, error: message };
  }

  await client
    .from("leads")
    .update({
      enrichment_status: "enriching",
      enrichment_error: null,
      enrichment_started_at: new Date().toISOString(),
      enrichment_attempts: (lead.enrichment_attempts ?? 0) + 1,
      linkedin_run_id: profileId,
      linkedin_posts_run_id: postsId,
      website_run_id: websiteId,
    })
    .eq("id", lead.id);

  return { started };
}

export interface PollOutcome {
  /** True once every run for this lead has reached a terminal state. */
  finished: boolean;
  /** Dollars Apify charged for the runs that finished on this pass. */
  costUsd: number;
  /** True when the lead ended up with usable material. */
  gotMaterial: boolean;
}

/**
 * Check a lead's in-flight runs and, once all are terminal, save what came
 * back. Safe to call repeatedly; does nothing while runs are still going.
 */
export async function pollLeadScrape(
  lead: Lead,
  client: Client,
  token: string,
): Promise<PollOutcome> {
  const ids = {
    profile: lead.linkedin_run_id,
    posts: lead.linkedin_posts_run_id,
    website: lead.website_run_id,
  };

  const fetchMeta = async (id: string | null) => {
    if (!id) return null;
    try {
      return await getRun(id, token);
    } catch {
      // A run we cannot read is treated as finished-and-empty rather than
      // holding the whole lead open forever.
      return { id, status: "FAILED" as const, defaultDatasetId: "", usageTotalUsd: 0 };
    }
  };

  const [profileRun, postsRun, websiteRun] = await Promise.all([
    fetchMeta(ids.profile),
    fetchMeta(ids.posts),
    fetchMeta(ids.website),
  ]);

  const runs = [profileRun, postsRun, websiteRun].filter(Boolean);
  const allDone = runs.every((r) => isTerminal(r!.status));
  const costUsd = runs.reduce((sum, r) => sum + (r!.usageTotalUsd ?? 0), 0);

  if (!allDone) return { finished: false, costUsd: 0, gotMaterial: false };

  const items = async <T,>(meta: typeof profileRun) => {
    if (!meta || meta.status !== "SUCCEEDED" || !meta.defaultDatasetId) return null;
    try {
      return await getDatasetItems<T>(meta.defaultDatasetId, token);
    } catch {
      return null;
    }
  };

  const linkedinUrl = pickLinkedIn(lead) ?? "";
  const [profileItems, postItems, websiteItems] = await Promise.all([
    items<LinkedInProfile>(profileRun),
    items<LinkedInPost>(postsRun),
    items<ApifyWebsiteItem>(websiteRun),
  ]);

  const profileSummary = profileItems ? summariseLinkedInItems(profileItems) : null;
  const postsSummary = postItems ? summariseLinkedInPosts(postItems, linkedinUrl) : null;
  const websiteSummary = websiteItems ? summariseWebsiteItems(websiteItems) : null;

  // Only overwrite where we actually got something, so a failed re-scrape
  // never wipes material an earlier run collected.
  const patch: Record<string, unknown> = {
    linkedin_run_id: null,
    linkedin_posts_run_id: null,
    website_run_id: null,
    enriched_at: new Date().toISOString(),
  };
  if (profileSummary) patch.linkedin_summary = profileSummary;
  if (postsSummary) patch.linkedin_posts_summary = postsSummary;
  if (websiteSummary) patch.website_summary = websiteSummary;

  const gotMaterial =
    !!profileSummary ||
    !!postsSummary ||
    !!websiteSummary ||
    !!lead.linkedin_summary ||
    !!lead.website_summary;

  if (gotMaterial) {
    patch.enrichment_status = "done";
    patch.enrichment_error = null;
  } else {
    patch.enrichment_status = "failed";
    patch.enrichment_error = "Every scrape came back empty";
  }

  await client.from("leads").update(patch).eq("id", lead.id);

  return { finished: true, costUsd, gotMaterial };
}
