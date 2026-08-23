"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  generateDmBatch,
  retryFailedDms,
  releaseStuckDms,
} from "@/lib/leads/linkedin-dm-actions";
import { DM_BATCH_SIZE, type DmProgress } from "@/lib/leads/linkedin-dm";

interface Props {
  avatarId: string;
  initial: DmProgress;
}

/**
 * Drives generation from the client, one batch of five per request.
 *
 * The loop lives here rather than server-side so that Stop is instant and a
 * long run can't outlive a serverless function timeout: each round trip is a
 * few seconds of work, and progress is durable in the database between them.
 * Closing the tab mid-run loses nothing already written.
 */
export default function GenerateDmBar({ avatarId, initial }: Props) {
  const router = useRouter();
  const [progress, setProgress] = useState<DmProgress>(initial);
  const [running, setRunning] = useState(false);
  const [errors, setErrors] = useState<{ name: string; error: string }[]>([]);
  const [fatal, setFatal] = useState<string | null>(null);
  const stop = useRef(false);

  // Free rows left claimed by a previous run that never finished.
  useEffect(() => {
    void releaseStuckDms(avatarId);
  }, [avatarId]);

  const run = useCallback(async () => {
    stop.current = false;
    setRunning(true);
    setErrors([]);
    setFatal(null);

    try {
      for (;;) {
        if (stop.current) break;

        const result = await generateDmBatch(avatarId);
        setProgress(result.progress);

        if (result.fatal) {
          setFatal(result.fatal);
          break;
        }
        if (result.errors.length) setErrors(result.errors);

        // Every lead in the batch failed — almost always a dead API key or an
        // empty account. Stop rather than burning through the whole list.
        if (result.processed > 0 && result.succeeded === 0) {
          setFatal(
            result.errors[0]?.error ??
              "Every lead in this batch failed. Stopped so the rest aren't wasted.",
          );
          break;
        }
        if (result.processed === 0) break;
      }
    } catch (err) {
      setFatal(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setRunning(false);
      router.refresh();
    }
  }, [avatarId, router]);

  async function onRetryFailed() {
    const result = await retryFailedDms(avatarId);
    if ("error" in result) {
      setFatal(result.error);
      return;
    }
    setFatal(null);
    setErrors([]);
    router.refresh();
    void run();
  }

  const { total, written, failed, remaining } = progress;
  const donePct = total > 0 ? Math.round(((written + failed) / total) * 100) : 0;

  return (
    <div className="mb-4 rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3">
      <div className="flex flex-wrap items-center gap-3">
        {running ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              stop.current = true;
            }}
          >
            Stop
          </Button>
        ) : (
          <Button size="sm" onClick={run} disabled={remaining === 0}>
            {remaining === 0
              ? "All messages written"
              : `Write messages for ${remaining.toLocaleString("en-GB")} leads`}
          </Button>
        )}

        <p
          className="text-[12px] text-[var(--text-secondary)]"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {written.toLocaleString("en-GB")} of {total.toLocaleString("en-GB")} written
          {failed > 0 && (
            <span className="text-[var(--status-danger)]">
              {" "}· {failed.toLocaleString("en-GB")} failed
            </span>
          )}
          {running && <span> · working in batches of {DM_BATCH_SIZE}…</span>}
        </p>

        {failed > 0 && !running && (
          <Button size="sm" variant="ghost" onClick={onRetryFailed}>
            Retry {failed.toLocaleString("en-GB")} failed
          </Button>
        )}
      </div>

      {total > 0 && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-overlay)]">
          <div
            className="h-full rounded-full bg-[var(--accent-primary)] transition-[width] duration-300"
            style={{ width: `${donePct}%` }}
          />
        </div>
      )}

      {fatal && (
        <div className="mt-2 rounded border border-[var(--status-danger)] bg-[var(--bg-base)] p-2">
          <p className="text-[12px] text-[var(--status-danger)]">
            Stopped: {fatal}
          </p>
          {/^Anthropic 400.*credit balance/i.test(fatal) && (
            <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
              Your Anthropic account is out of credit. Top it up and press the
              button again — nothing already written is lost.
            </p>
          )}
        </div>
      )}

      {errors.length > 0 && !fatal && (
        <ul className="mt-2 space-y-0.5">
          {errors.map((e, i) => (
            <li key={i} className="text-[11px] text-[var(--text-tertiary)]">
              {e.name}: {e.error}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
