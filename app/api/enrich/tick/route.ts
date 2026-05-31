import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { finalizeEnrichment, startEnrichment } from "@/lib/enrichment";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Slow and steady: 1 lead per tick. With a 2-minute cron interval that's
// ~30 leads/hour — the whole pipeline (Apify website + LinkedIn + Claude)
// can run unhurried without competing parallel work.
const BATCH_SIZE = 1;
// Apify's LinkedIn scraper can legitimately take 10-15 min per profile. We
// only force-fail once a run is *clearly* abandoned. The finalize step is
// always attempted first; this timeout is a backstop, not a primary check.
const STUCK_AFTER_MS = 30 * 60 * 1000;

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

  // Workspace-level kill switch. The cron stays scheduled on Netlify but
  // does no work when disabled — flip the toggle in Settings to resume.
  const { data: settings } = await supabase
    .from("workspace_settings")
    .select("cron_enabled")
    .eq("id", 1)
    .maybeSingle();
  const cronEnabled = (settings as { cron_enabled?: boolean } | null)?.cron_enabled ?? true;
  if (!cronEnabled) {
    return NextResponse.json({ ok: true, paused: true, elapsed_ms: Date.now() - startedAt });
  }

  const summary = {
    finalized: 0,
    stillRunning: 0,
    forceFailed: 0,
    started: 0,
    started_priority: 0,
    startFailed: 0,
    plans_promoted: 0,
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

    // ALWAYS try to finalize first — Apify may have completed legitimately,
    // even past our wall-clock timeout. Only after finalize says "still
    // running" do we consider force-failing on age.
    let finalized = false;
    try {
      const result = await finalizeEnrichment(row.id, supabase);
      if (result.ok && result.status === "done") {
        summary.finalized++;
        finalized = true;
      } else if (result.ok) {
        // Still running on Apify's side.
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
        } else {
          summary.stillRunning++;
        }
      } else {
        summary.errors.push(`${row.id}: ${result.error}`);
      }
    } catch (e) {
      summary.errors.push(`${row.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (finalized) continue;
  }

  // ─── 2. Start new enrichments ─────────────────────────────────────────────
  // Priority queue covers two cases:
  //   (a) 'pending' — fresh queue from a plan's "Generate icebreakers"
  //   (b) 'failed' inside a plan — auto-retry, so a plan can self-heal
  //       without the user re-clicking Generate icebreakers
  // Background queue (no plan, just qualified) is the residual.
  const { data: priorityRows } = await supabase
    .from("leads")
    .select("id")
    .eq("qualified", "qualified")
    .is("icebreaker", null)
    .or(
      "enrichment_status.eq.pending," +
        "and(enrichment_status.eq.failed,campaign_plan_id.not.is.null)",
    )
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  const priorityIds = ((priorityRows ?? []) as { id: string }[]).map((r) => r.id);
  const remaining = BATCH_SIZE - priorityIds.length;

  let backgroundIds: string[] = [];
  if (remaining > 0) {
    const { data: bgRows } = await supabase
      .from("leads")
      .select("id")
      .eq("qualified", "qualified")
      .is("icebreaker", null)
      .or("enrichment_status.is.null,enrichment_status.eq.failed")
      .order("created_at", { ascending: true })
      .limit(remaining);
    backgroundIds = ((bgRows ?? []) as { id: string }[]).map((r) => r.id);
  }

  for (const id of priorityIds) {
    try {
      const result = await startEnrichment(id, supabase);
      if (result.ok) {
        summary.started++;
        summary.started_priority++;
      } else {
        summary.startFailed++;
        summary.errors.push(`${id}: ${result.error}`);
      }
    } catch (e) {
      summary.startFailed++;
      summary.errors.push(`${id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  for (const id of backgroundIds) {
    try {
      const result = await startEnrichment(id, supabase);
      if (result.ok) summary.started++;
      else {
        summary.startFailed++;
        summary.errors.push(`${id}: ${result.error}`);
      }
    } catch (e) {
      summary.startFailed++;
      summary.errors.push(`${id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ─── 3. Promote plans whose leads are fully enriched ──────────────────────
  // For every plan currently 'enriching', if all assigned leads have an
  // icebreaker, flip to 'ready' so the UI shows the Push button.
  const { data: enrichingPlans } = await supabase
    .from("campaign_plans")
    .select("id")
    .eq("status", "enriching");
  for (const p of (enrichingPlans ?? []) as { id: string }[]) {
    const { data: leadRows } = await supabase
      .from("leads")
      .select("icebreaker")
      .eq("campaign_plan_id", p.id);
    const rows = (leadRows ?? []) as { icebreaker: string | null }[];
    if (rows.length === 0) continue;
    const allDone = rows.every((l) => !!l.icebreaker);
    if (allDone) {
      await supabase
        .from("campaign_plans")
        .update({ status: "ready", updated_at: new Date().toISOString() })
        .eq("id", p.id);
      summary.plans_promoted++;
    }
  }

  return NextResponse.json({
    ok: true,
    elapsed_ms: Date.now() - startedAt,
    ...summary,
  });
}
