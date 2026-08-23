"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  advanceDmRunFor,
  getProgressFor,
  clampBatchSize,
  type RunStepResult,
} from "@/lib/leads/linkedin-dm-worker";
import { DM_BATCH_SIZE, EMPTY_USAGE, type DmProgress } from "@/lib/leads/linkedin-dm";

/**
 * Server actions for the LinkedIn DM run.
 *
 * The work itself lives in linkedin-dm-worker.ts, which takes a Supabase
 * client rather than making one. These wrappers add the signed-in user check
 * and pass their session's client; the scheduled worker calls the same
 * functions with a service-role client instead. One implementation, two
 * callers, so the browser and the background run cannot drift apart.
 */

export async function getDmProgress(avatarId: string): Promise<DmProgress> {
  const supabase = await createClient();
  return getProgressFor(avatarId, supabase);
}

/** One slice of a run, driven by the open tab. */
export async function advanceDmRun(
  avatarId: string,
  batchSize?: number,
): Promise<RunStepResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      scrapesStarted: 0,
      scrapesFinished: 0,
      written: 0,
      failed: 0,
      progress: await getProgressFor(avatarId, supabase),
      usage: EMPTY_USAGE,
      apifyUsd: 0,
      errors: [],
      fatal: "Not authenticated.",
      workRemains: false,
    };
  }

  return advanceDmRunFor(avatarId, clampBatchSize(batchSize), supabase);
}

/* ───────────────────────────── run state ──────────────────────────────── */

export interface RunState {
  active: boolean;
  batchSize: number;
  /** Messages to stop at; null means until the campaign is finished. */
  target: number | null;
  startedAt: string | null;
}

export async function getRunState(avatarId: string): Promise<RunState> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("avatars")
    .select("dm_run_active, dm_run_batch_size, dm_run_target, dm_run_started_at")
    .eq("id", avatarId)
    .maybeSingle();

  return {
    active: Boolean(data?.dm_run_active),
    batchSize: (data?.dm_run_batch_size as number) ?? DM_BATCH_SIZE,
    target: (data?.dm_run_target as number | null) ?? null,
    startedAt: (data?.dm_run_started_at as string | null) ?? null,
  };
}

/**
 * Mark the campaign as running so the scheduled worker keeps going without the
 * browser. The tab drives it faster while open; this is what survives the
 * laptop being shut.
 */
export async function startRun(
  avatarId: string,
  batchSize: number,
  runSize: number,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const progress = await getProgressFor(avatarId, supabase);
  // Stored as an absolute finishing line rather than "how many more", so the
  // worker and the browser cannot disagree about what is left to do.
  const target = runSize > 0 ? progress.written + runSize : null;

  const { error } = await supabase
    .from("avatars")
    .update({
      dm_run_active: true,
      dm_run_batch_size: clampBatchSize(batchSize),
      dm_run_target: target,
      dm_run_started_at: new Date().toISOString(),
      dm_run_started_by: user.id,
    })
    .eq("id", avatarId);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function stopRun(avatarId: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("avatars")
    .update({ dm_run_active: false, dm_run_target: null })
    .eq("id", avatarId);
}

/* ─────────────────────────── fixing things up ─────────────────────────── */

/** Clear the failed marker so the next run picks these up again. */
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
 * Release rows left mid-flight by a run that stopped abruptly, so they aren't
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
