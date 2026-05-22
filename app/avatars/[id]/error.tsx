"use client";

import { useEffect } from "react";

export default function HubError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[avatar-hub]", error);
  }, [error]);

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: "var(--bg-base)" }}
    >
      <div
        className="max-w-xl w-full rounded-lg border p-6 space-y-3"
        style={{
          background: "var(--bg-elevated)",
          borderColor: "var(--border-subtle)",
        }}
      >
        <h1 className="font-display text-[20px] font-medium">
          The Channels hub failed to render.
        </h1>
        <p className="text-sm text-[var(--text-secondary)]">
          {error.message ?? "Unknown error."}
        </p>
        {error.digest && (
          <p className="text-[11px] font-mono text-[var(--text-tertiary)]">
            digest: {error.digest}
          </p>
        )}
        {error.stack && (
          <pre className="text-[11px] font-mono whitespace-pre-wrap text-[var(--text-tertiary)] max-h-72 overflow-auto rounded-md border p-3"
               style={{ borderColor: "var(--border-subtle)", background: "var(--bg-overlay)" }}>
            {error.stack}
          </pre>
        )}
        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-[var(--accent-primary)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)]"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-md border px-3 py-1.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-overlay)]"
            style={{ borderColor: "var(--border-default)" }}
          >
            Back to Avatars
          </a>
        </div>
      </div>
    </div>
  );
}
