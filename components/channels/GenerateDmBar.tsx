"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  generateDmBatch,
  retryFailedDms,
  releaseStuckDms,
  getDmPreflight,
  type DmPreflight,
} from "@/lib/leads/linkedin-dm-actions";
import {
  DM_BATCH_SIZE,
  DM_BATCH_OPTIONS,
  DM_RUN_SIZE_OPTIONS,
  EMPTY_USAGE,
  addUsage,
  costOf,
  formatCost,
  type DmProgress,
  type TokenUsage,
} from "@/lib/leads/linkedin-dm";

interface Props {
  avatarId: string;
  initial: DmProgress;
}

const RUN_SIZE_LABEL = (n: number) => (n === 0 ? "All remaining" : `${n} leads`);

/** Radial progress. Written by hand so it needs no charting dependency. */
function ProgressRing({
  written,
  failed,
  total,
  running,
}: {
  written: number;
  failed: number;
  total: number;
  running: boolean;
}) {
  const size = 72;
  const stroke = 7;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;

  const donePct = total > 0 ? written / total : 0;
  const failPct = total > 0 ? failed / total : 0;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--bg-overlay)"
          strokeWidth={stroke}
        />
        {/* Failures sit behind, so the written arc always reads first. */}
        {failPct > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="var(--status-danger)"
            strokeWidth={stroke}
            strokeDasharray={`${failPct * circumference} ${circumference}`}
            strokeDashoffset={-donePct * circumference}
            strokeLinecap="round"
          />
        )}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent-primary)"
          strokeWidth={stroke}
          strokeDasharray={`${donePct * circumference} ${circumference}`}
          strokeLinecap="round"
          className="transition-[stroke-dasharray] duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-[15px] font-semibold leading-none text-[var(--text-primary)]"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {total > 0 ? Math.round(donePct * 100) : 0}%
        </span>
        {running && (
          <span className="mt-0.5 text-[9px] uppercase tracking-wide text-[var(--text-tertiary)]">
            live
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Drives generation from the client, one batch per request.
 *
 * The loop lives here rather than server-side so Stop is instant and a long
 * run cannot outlive a serverless function timeout: each round trip is a few
 * seconds of work, and progress is durable in the database between them.
 * Closing the tab loses nothing already written.
 */
export default function GenerateDmBar({ avatarId, initial }: Props) {
  const router = useRouter();
  const [progress, setProgress] = useState<DmProgress>(initial);
  const [running, setRunning] = useState(false);
  const [errors, setErrors] = useState<{ name: string; error: string }[]>([]);
  const [fatal, setFatal] = useState<string | null>(null);
  const stop = useRef(false);

  const [batchSize, setBatchSize] = useState<number>(DM_BATCH_SIZE);
  const [runSize, setRunSize] = useState<number>(25);
  const [preflight, setPreflight] = useState<DmPreflight | null>(null);

  // Usage accumulates across the batches of one run and resets when you start
  // another, so the figure always answers "what has this run cost me".
  const [usage, setUsage] = useState<TokenUsage>(EMPTY_USAGE);
  const [writtenThisRun, setWrittenThisRun] = useState(0);

  // Free rows left claimed by a previous run that never finished.
  useEffect(() => {
    void releaseStuckDms(avatarId);
  }, [avatarId]);

  // Refresh the "what will this do" figures whenever the dials move.
  useEffect(() => {
    if (running) return;
    let cancelled = false;
    void getDmPreflight(avatarId, runSize).then((p) => {
      if (!cancelled) setPreflight(p);
    });
    return () => {
      cancelled = true;
    };
  }, [avatarId, runSize, running, progress.written]);

  const run = useCallback(async () => {
    stop.current = false;
    setRunning(true);
    setErrors([]);
    setFatal(null);
    setUsage(EMPTY_USAGE);
    setWrittenThisRun(0);

    let doneThisRun = 0;

    try {
      for (;;) {
        if (stop.current) break;
        // runSize 0 means "keep going until the campaign is finished".
        if (runSize > 0 && doneThisRun >= runSize) break;

        const room = runSize > 0 ? runSize - doneThisRun : batchSize;
        const result = await generateDmBatch(avatarId, Math.min(batchSize, room));

        setProgress(result.progress);
        setUsage((u) => addUsage(u, result.usage));

        if (result.fatal) {
          setFatal(result.fatal);
          break;
        }
        if (result.errors.length) setErrors(result.errors);

        doneThisRun += result.processed;
        setWrittenThisRun(doneThisRun);

        // Every lead in the batch failed: almost always a dead API key or an
        // empty account. Stop rather than burning through the whole list.
        if (result.processed > 0 && result.succeeded === 0) {
          setFatal(
            result.errors[0]?.error ??
              "Every lead in this batch failed. Stopped so the rest are not wasted.",
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
  }, [avatarId, batchSize, runSize, router]);

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
  const spend = costOf(usage);
  const perLead = writtenThisRun > 0 ? spend / writtenThisRun : 0;
  const cacheHitting = usage.cacheRead > 0;

  return (
    <div className="mb-4 rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3">
      <div className="flex flex-wrap items-center gap-4">
        <ProgressRing
          written={written}
          failed={failed}
          total={total}
          running={running}
        />

        <div className="min-w-[150px]">
          <p
            className="text-[13px] text-[var(--text-primary)]"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {written.toLocaleString("en-GB")} of {total.toLocaleString("en-GB")} written
          </p>
          {failed > 0 && (
            <p className="text-[12px] text-[var(--status-danger)]">
              {failed.toLocaleString("en-GB")} failed
            </p>
          )}
          {!running && remaining > 0 && (
            <p className="text-[12px] text-[var(--text-tertiary)]">
              {remaining.toLocaleString("en-GB")} still to do
            </p>
          )}
        </div>

        {/* Dials — locked while a run is in flight so they cannot change
            underneath it mid-loop. */}
        <div className="space-y-1">
          <Label className="text-[11px]">At a time</Label>
          <Select
            value={String(batchSize)}
            onValueChange={(v) => setBatchSize(Number(v) || DM_BATCH_SIZE)}
            disabled={running}
          >
            <SelectTrigger className="h-8 w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DM_BATCH_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-[11px]">This run</Label>
          <Select
            value={String(runSize)}
            onValueChange={(v) => setRunSize(Number(v))}
            disabled={running}
          >
            <SelectTrigger className="h-8 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DM_RUN_SIZE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {RUN_SIZE_LABEL(n)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
            {remaining === 0 ? "All messages written" : "Write messages"}
          </Button>
        )}

        {failed > 0 && !running && (
          <Button size="sm" variant="ghost" onClick={onRetryFailed}>
            Retry {failed.toLocaleString("en-GB")} failed
          </Button>
        )}

        {/* Live spend */}
        {(running || spend > 0) && (
          <div className="ml-auto text-right">
            <p
              className="text-[15px] font-semibold text-[var(--text-primary)]"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {formatCost(spend)}
            </p>
            <p className="text-[11px] text-[var(--text-tertiary)]">
              this run
              {perLead > 0 && ` · ${formatCost(perLead)}/lead`}
              {cacheHitting && " · cached"}
            </p>
          </div>
        )}
      </div>

      {/* What the run is about to do */}
      {!running && preflight && preflight.willWrite > 0 && (
        <p className="mt-2 text-[12px] text-[var(--text-secondary)]">
          Next run writes {preflight.willWrite.toLocaleString("en-GB")} lead
          {preflight.willWrite === 1 ? "" : "s"}, {batchSize} at a time.
          {preflight.noMaterial > 0 && (
            <span className="text-[var(--status-warning,var(--text-tertiary))]">
              {" "}
              {preflight.noMaterial.toLocaleString("en-GB")} of them have never
              been scraped, so those messages will only have a job title and a
              firm name to work from.
            </span>
          )}
        </p>
      )}

      {fatal && (
        <div className="mt-2 rounded border border-[var(--status-danger)] bg-[var(--bg-base)] p-2">
          <p className="text-[12px] text-[var(--status-danger)]">Stopped: {fatal}</p>
          {/^Anthropic 400.*credit balance/i.test(fatal) && (
            <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
              Your Anthropic account is out of credit. Top it up and press the
              button again, nothing already written is lost.
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
