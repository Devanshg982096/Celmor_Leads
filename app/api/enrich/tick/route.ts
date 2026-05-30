import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { finalizeEnrichment, startEnrichment } from "@/lib/enrichment";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BATCH_SIZE = 2;
// Treat enrichments running for >10 min as stuck and re-queue them.
const STUCK_AFTER_MS = 10 * 60 * 1000;

/**
 * Scheduled tick: progresses in-flight enrichments and starts new ones.
 *
 * 1. For every lead currently 'enriching', try finalizeEnrichment. Apify runs
 *    that have completed get persisted; runs still in flight are left alone.
 *    Runs older than STUCK_AFTER_MS get force-failed so the slot frees up.
 * 2. Up to BATCH_SIZE qualified leads with no icebreaker get a fresh
 *    startEnrichment.
 *
 * Auth: bearer token in Authorization header must match CRON_SECRET env.
 * Uses the service-role Supabase client so it works without a user session.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const startedAt = Date.now();
  const summary = {
    finalized: 0,
    stillRunning: 0,
    forceFailed: 0,
    started: 0,
    startFailed: 0,
    errors: [] as string[],
  };

  // ─── 1. Progress in-flight enrichments ────────────────────────────────────
  const { data: inflight } = await supabase
    .from("leads")
    .select("id, enrichment_started_at")
    .eq("enrichment_status", "enriching");

  for (const row of (inflight ?? []) as { id: string; enrichment_started_at: string | null }[]) {
    const ageMs = row.enrichment_started_at
      ? Date.now() - new Date(row.enrichment_started_at).getTime()
      : Number.POSITIVE_INFINITY;
    if (ageMs > STUCK_AFTER_MS) {
      await supabase
        .from("leads")
        .update({
          enrichment_status: "failed",
          enrichment_error: `Stuck >${Math.round(STUCK_AFTER_MS / 60000)} min — force failed by cron`,
          website_run_id: null,
          linkedin_run_id: null,
        })
        .eq("id", row.id);
      summary.forceFailed++;
      continue;
    }
    try {
      const result = await finalizeEnrichment(row.id, supabase);
      if (result.ok && result.status === "done") summary.finalized++;
      else if (result.ok) summary.stillRunning++;
      else summary.errors.push(`${row.id}: ${result.error}`);
    } catch (e) {
      summary.errors.push(`${row.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ─── 2. Start new enrichments ─────────────────────────────────────────────
  const { data: candidates } = await supabase
    .from("leads")
    .select("id")
    .eq("qualified", "qualified")
    .is("icebreaker", null)
    .or("enrichment_status.is.null,enrichment_status.eq.failed")
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  for (const row of (candidates ?? []) as { id: string }[]) {
    try {
      const result = await startEnrichment(row.id, supabase);
      if (result.ok) summary.started++;
      else {
        summary.startFailed++;
        summary.errors.push(`${row.id}: ${result.error}`);
      }
    } catch (e) {
      summary.startFailed++;
      summary.errors.push(`${row.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return NextResponse.json({
    ok: true,
    elapsed_ms: Date.now() - startedAt,
    ...summary,
  });
}
