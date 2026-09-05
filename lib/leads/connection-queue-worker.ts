import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { startRun, getRun, getDatasetItems, isTerminal } from "@/lib/enrichment/apify";
import { LINKEDIN_ACTOR_ID, buildLinkedInInput } from "@/lib/enrichment/linkedin";
import { canonicalLinkedInUrl, mapProfile } from "./profile-import";

export async function advanceConnectionQueue(db: SupabaseClient, avatarId: string) {
  const { data: settings, error: settingsError } = await db.from("workspace_settings").select("apify_token").eq("id", 1).single();
  if (settingsError || !settings?.apify_token) throw new Error("Check the Apify connection in Settings.");
  const { data: jobs, error: claimError } = await db.rpc("claim_profile_import", { p_avatar: avatarId });
  if (claimError) throw new Error("Could not claim the next URL. Please try again.");
  const job = jobs?.[0];
  if (!job) return;
  const update = async (patch: Record<string, unknown>) => {
    const { error } = await db.from("profile_import_queue").update({ ...patch, lease_until: null, lease_token: null })
      .eq("id", job.id).eq("lease_token", job.lease_token);
    if (error) throw new Error("Could not save lookup progress.");
  };
  try {
    if (!job.run_id) {
      const { data: existing, error } = await db.rpc("finish_profile_import", { p_job: job.id, p_lease: job.lease_token, p_draft: null });
      if (error) throw new Error("Could not check existing leads.");
      if (existing) return;
      // Each request performs one external operation, staying within function timeouts.
      const run = await startRun(LINKEDIN_ACTOR_ID, buildLinkedInInput(job.linkedin_url), settings.apify_token);
      await update({ run_id: run.id });
      return;
    }
    if (!job.dataset_id) {
      const run = await getRun(job.run_id, settings.apify_token);
      if (!isTerminal(run.status)) { await update({}); return; }
      if (run.status !== "SUCCEEDED") {
        await update({ status: "failed", error: `Apify lookup ${run.status.toLowerCase()}. Check Apify, then retry.`, run_id: null });
        return;
      }
      await update({ dataset_id: run.defaultDatasetId });
      return;
    }
    const items = await getDatasetItems<Record<string, unknown>>(job.dataset_id, settings.apify_token);
    const profile = items.find(item => {
      try { return canonicalLinkedInUrl(String(item.linkedinUrl ?? item.linkedinPublicUrl ?? item.inputUrl ?? "")) === job.linkedin_url; }
      catch { return false; }
    });
    if (!profile) { await update({ status: "failed", error: "Apify returned no matching profile. Check the URL, then retry.", run_id: null, dataset_id: null }); return; }
    let draft;
    try { draft = mapProfile(profile); }
    catch { await update({ status: "failed", error: "Apify returned no usable details. Check the profile, then retry.", run_id: null, dataset_id: null }); return; }
    const { error } = await db.rpc("finish_profile_import", { p_job: job.id, p_lease: job.lease_token, p_draft: draft });
    if (error) throw new Error("Could not save the lead.");
  } catch {
    // Keep known run/dataset IDs so retry resumes instead of charging for another scrape.
    await update({ status: "failed", error: job.run_id
      ? "The lookup was interrupted. Retry will resume the saved Apify result."
      : "Apify could not start or its response was interrupted. Check your credits and Apify runs before retrying; retry may start a new paid lookup." });
  }
}
