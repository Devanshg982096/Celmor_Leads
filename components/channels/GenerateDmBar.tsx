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
  advanceDmRun,
  retryFailedDms,
  releaseStuckDms,
  rewriteDms,
  startRun,
  stopRun,
  getRunState,
  getDmProgress,
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
  const [phase, setPhase] = useState<string>("");

  // Spend accumulates across one run and resets when you start another, so the
  // figure always answers "what has this run cost me".
  const [usage, setUsage] = useState<TokenUsage>(EMPTY_USAGE);
  const [apifyUsd, setApifyUsd] = useState(0);
  const [writtenThisRun, setWrittenThisRun] = useState(0);

  // Free rows left claimed by a run that stopped abruptly.
  useEffect(() => {
    void releaseStuckDms(avatarId);
  }, [avatarId]);

  // A run started here carries on server-side after the tab closes, so on
  // arrival rejoin one already in progress rather than showing it as idle.
  useEffect(() => {
    let cancelled = false;
    void getRunState(avatarId).then((state) => {
      if (cancelled || !state.active) return;
      setBatchSize(state.batchSize);
      void run();
    });
    return () => {
      cancelled = true;
    };
    // Deliberately only on mount: re-running this on every render would
    // restart the loop endlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarId]);

  const run = useCallback(async () => {
    stop.current = false;
    setRunning(true);
    setErrors([]);
    setFatal(null);
    setUsage(EMPTY_USAGE);
    setApifyUsd(0);
    setWrittenThisRun(0);
    setPhase("Starting");

    let doneThisRun = 0;
    // Scrapes take 30-90s at Apify. When a pass writes nothing because
    // everything is still out being read, wait before asking again rather
    // than spinning against the API.
    let idlePasses = 0;

    try {
      for (;;) {
        if (stop.current) break;
        // runSize 0 means "keep going until the campaign is finished".
        if (runSize > 0 && doneThisRun >= runSize) break;

        const room = runSize > 0 ? runSize - doneThisRun : batchSize;
        const result = await advanceDmRun(avatarId, Math.min(batchSize, room));

        setProgress(result.progress);
        setUsage((u) => addUsage(u, result.usage));
        setApifyUsd((c) => c + result.apifyUsd);

        if (result.fatal) {
          setFatal(result.fatal);
          break;
        }
        if (result.errors.length) setErrors(result.errors);

        doneThisRun += result.written;
        setWrittenThisRun(doneThisRun);

        setPhase(
          result.written > 0
            ? `Wrote ${result.written}`
            : result.progress.scraping > 0
              ? `Reading ${result.progress.scraping} profile${result.progress.scraping === 1 ? "" : "s"}`
              : "Working",
        );

        if (!result.workRemains) break;

        if (result.written === 0 && result.scrapesFinished === 0) {
          idlePasses++;
          // Nothing came back at all: give Apify time before the next look.
          await new Promise((r) => setTimeout(r, Math.min(3000 * idlePasses, 12000)));
          // A long stall with nothing in flight means it is stuck, not slow.
          if (idlePasses > 12 && result.progress.scraping === 0) {
            setFatal("Nothing progressed for a while. Stopped so it does not spin.");
            break;
          }
        } else {
          idlePasses = 0;
        }
      }
    } catch (err) {
      setFatal(err instanceof Error ? err.message : "Run failed.");
    } finally {
      setRunning(false);
      setPhase("");
      router.refresh();
    }
  }, [avatarId, batchSize, runSize, router]);

  /** Record the run server-side first, so closing the tab does not end it. */
  async function onStart() {
    const result = await startRun(avatarId, batchSize, runSize);
    if ("error" in result) {
      setFatal(result.error);
      return;
    }
    void run();
  }

  async function onStop() {
    stop.current = true;
    await stopRun(avatarId);
    setProgress(await getDmProgress(avatarId));
  }

  async function onRewrite(scope: "all" | "flagged" | "unscraped") {
    const result = await rewriteDms(avatarId, scope);
    if ("error" in result) {
      setFatal(result.error);
      return;
    }
    router.refresh();
  }

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
  const aiSpend = costOf(usage);
  const spend = aiSpend + apifyUsd;
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
          {running ? (
            <>
              <p className="text-[12px] text-[var(--text-tertiary)]">
                {phase}
                {progress.scraping > 0 && ` · ${progress.scraping} being read`}
              </p>
              <p className="text-[11px] text-[var(--text-tertiary)]">
                Keeps going if you close this
              </p>
            </>
          ) : (
            remaining > 0 && (
              <p className="text-[12px] text-[var(--text-tertiary)]">
                {remaining.toLocaleString("en-GB")} still to do
              </p>
            )
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
          <Button size="sm" variant="outline" onClick={onStop}>
            Stop
          </Button>
        ) : (
          <Button size="sm" onClick={onStart} disabled={remaining === 0}>
            {remaining === 0 ? "All messages written" : "Read and write"}
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
            </p>
            <p className="text-[11px] text-[var(--text-tertiary)]">
              AI {formatCost(aiSpend)}
              {cacheHitting && " (cached)"} · scraping {formatCost(apifyUsd)}
            </p>
          </div>
        )}
      </div>

      {/* Where the remaining leads actually are */}
      {!running && remaining > 0 && (
        <p className="mt-2 text-[12px] text-[var(--text-secondary)]">
          {progress.needScrape > 0 && (
            <>
              {progress.needScrape.toLocaleString("en-GB")} still need their
              LinkedIn read.{" "}
            </>
          )}
          {progress.readyToWrite > 0 && (
            <>
              {progress.readyToWrite.toLocaleString("en-GB")} read already and
              just need writing.{" "}
            </>
          )}
          {progress.scraping > 0 && (
            <>{progress.scraping.toLocaleString("en-GB")} still out being read. </>
          )}
          Runs {batchSize} at a time.
        </p>
      )}

      {/* Rewrite: the first leads through were written before their LinkedIn
          was read, so their messages are worse than everything after. */}
      {!running && written > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-[var(--text-tertiary)]">Rewrite:</span>
          <Button size="sm" variant="ghost" onClick={() => onRewrite("unscraped")}>
            Ones written before reading
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onRewrite("flagged")}>
            Flagged ones
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onRewrite("all")}>
            All {written.toLocaleString("en-GB")}
          </Button>
        </div>
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
