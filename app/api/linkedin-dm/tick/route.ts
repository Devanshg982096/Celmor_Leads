import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { advanceDmRunFor } from "@/lib/leads/linkedin-dm-worker";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Carries on any LinkedIn DM run whose browser tab has gone away.
 *
 * The tab drives its own loop while it is open, which is faster and gives an
 * instant Stop. This exists so shutting the laptop pauses nothing: the run is
 * recorded on the avatar, and this picks it up from wherever it got to.
 *
 * Both can safely run at once. Leads are claimed row by row before any work
 * starts, so the worker and the browser cannot write the same lead twice.
 *
 * Authenticated by the shared CRON_SECRET, and carved out of the auth
 * middleware in proxy.ts, since a scheduler has no user session.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not set" }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Leave headroom under maxDuration so the response still gets out.
  const deadline = Date.now() + 45_000;
  const supabase = createAdminClient();

  const { data: runs, error } = await supabase
    .from("avatars")
    .select("id, name, dm_run_batch_size, dm_run_target")
    .eq("dm_run_active", true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!runs || runs.length === 0) {
    return NextResponse.json({ ok: true, activeRuns: 0 });
  }

  const summary: Record<string, unknown>[] = [];

  for (const run of runs) {
    const avatarId = run.id as string;
    const batchSize = (run.dm_run_batch_size as number) ?? 5;
    const target = (run.dm_run_target as number | null) ?? null;

    let written = 0;
    let apifyUsd = 0;
    let passes = 0;
    let stopReason = "deadline";

    while (Date.now() < deadline) {
      const step = await advanceDmRunFor(avatarId, batchSize, supabase);
      passes++;
      written += step.written;
      apifyUsd += step.apifyUsd;

      if (step.fatal) {
        // A dead key or empty account will not fix itself on the next tick.
        await supabase
          .from("avatars")
          .update({ dm_run_active: false })
          .eq("id", avatarId);
        stopReason = `stopped: ${step.fatal}`;
        break;
      }

      if (target !== null && step.progress.written >= target) {
        await supabase
          .from("avatars")
          .update({ dm_run_active: false, dm_run_target: null })
          .eq("id", avatarId);
        stopReason = "target reached";
        break;
      }

      if (!step.workRemains) {
        await supabase
          .from("avatars")
          .update({ dm_run_active: false, dm_run_target: null })
          .eq("id", avatarId);
        stopReason = "finished";
        break;
      }

      // Everything is out at Apify being read. Hand the tick back rather than
      // burning its remaining seconds polling; the next one picks it up.
      if (step.written === 0 && step.scrapesFinished === 0) {
        stopReason = "waiting on scrapes";
        break;
      }
    }

    summary.push({
      avatar: run.name,
      passes,
      written,
      apifyUsd: Number(apifyUsd.toFixed(4)),
      stopReason,
    });
  }

  return NextResponse.json({ ok: true, activeRuns: runs.length, summary });
}
