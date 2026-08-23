"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { previewLine, type DmState } from "@/lib/leads/linkedin-dm";

interface Props {
  state: DmState;
}

/**
 * One message column cell.
 *
 * Click copies the whole message. Hover shows it in full so you can check it
 * before sending without opening anything.
 *
 * The row underneath opens the lead drawer on click, so every pointer handler
 * here stops propagation — otherwise copying a message would also open the
 * drawer over the top of it.
 */
export default function DmCell({ state }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  const copyable = state.kind === "ready" || state.kind === "fixed-only";
  const text = copyable ? state.text : "";

  const copy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!copyable) return;
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setFailed(false);
      } catch {
        // Clipboard is blocked over plain http and in some embedded browsers.
        // Say so rather than silently appearing to have copied.
        setFailed(true);
        setCopied(false);
      }
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => {
        setCopied(false);
        setFailed(false);
      }, 1600);
    },
    [copyable, text],
  );

  const line = previewLine(state);

  const tone =
    state.kind === "ready"
      ? "text-[var(--text-primary)]"
      : state.kind === "failed"
        ? "text-[var(--status-danger)]"
        : "text-[var(--text-tertiary)]";

  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={copy}
        disabled={!copyable}
        title={copyable ? "Click to copy" : undefined}
        className={
          "block w-[220px] truncate text-left text-[13px] leading-snug " +
          (copyable
            ? "cursor-pointer hover:underline underline-offset-2 "
            : "cursor-default ") +
          tone
        }
      >
        {copied ? (
          <span className="text-[var(--status-success)]">Copied</span>
        ) : failed ? (
          <span className="text-[var(--status-danger)]">Press Ctrl+C</span>
        ) : (
          line
        )}
      </button>

      {open && (state.kind === "ready" || state.kind === "fixed-only" || state.kind === "failed") && (
        <div
          className="absolute left-0 top-full z-50 mt-1 w-[420px] rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3 shadow-lg"
          // The preview sits over neighbouring rows; without this a click
          // inside it would fall through and open the wrong lead.
          onClick={(e) => e.stopPropagation()}
        >
          {state.kind === "failed" ? (
            <p className="text-[12px] text-[var(--status-danger)]">{state.error}</p>
          ) : (
            <>
              <pre className="max-h-[320px] overflow-y-auto whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-[var(--text-primary)]">
                {state.text}
              </pre>
              <p className="mt-2 border-t border-[var(--border-subtle)] pt-2 text-[11px] text-[var(--text-tertiary)]">
                {state.kind === "fixed-only"
                  ? "No personalised line for this one. Click to copy."
                  : "Click to copy"}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
