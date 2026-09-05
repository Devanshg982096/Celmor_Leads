"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { QUEUE_LABELS, type ConnectionQueueItem } from "@/lib/leads/connection-queue";
import { readConnectionQueue, addConnectionUrls, controlConnectionQueue, tickConnectionQueue } from "@/lib/leads/connection-queue-actions";

export default function ConnectionQueue({ avatarId }: { avatarId: string }) {
  const router = useRouter();
  const [items, setItems] = useState<ConnectionQueueItem[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const completed = useRef(-1);
  const refresh = useCallback(async () => {
    const result = await readConnectionQueue(avatarId);
    if (result.error) throw new Error(result.error);
    const rows = result.items ?? [];
    setItems(rows); setLoading(false);
    const count = rows.filter(row => row.status === "done").length;
    if (completed.current >= 0 && completed.current !== count) router.refresh();
    completed.current = count;
    return rows;
  }, [avatarId, router]);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function step() {
      try {
        const rows = await refresh();
        if (stopped) return;
        if (rows.some(row => row.status === "queued" || row.status === "processing")) {
          const result = await tickConnectionQueue(avatarId);
          if (result.error && !stopped) setError(result.error);
        }
      } catch (e) { if (!stopped) { setLoading(false); setError(e instanceof Error ? e.message : "Could not load the list."); } }
      if (!stopped) timer = setTimeout(step, 4000);
    }
    void step();
    return () => { stopped = true; clearTimeout(timer); };
  }, [avatarId, refresh]);

  async function save(value: string) {
    if (!value.trim() || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await addConnectionUrls(avatarId, value);
      if (result.error) throw new Error(result.error);
      setText(""); setNotice("Saved. Repeated URLs are kept only once."); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save. Please try again."); }
    finally { setBusy(false); }
  }
  async function control(action: "start" | "pause" | "retry" | "remove", id?: string) {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await controlConnectionQueue(avatarId, action, id);
      if (result.error) throw new Error(result.error);
      if (action === "pause") setNotice("Paused waiting URLs. The current lookup will finish.");
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not update the list."); }
    finally { setBusy(false); }
  }
  const saved = items.filter(row => row.status === "draft").length;
  const active = items.filter(row => row.status === "queued" || row.status === "processing").length;
  const done = items.filter(row => row.status === "done").length;
  const failed = items.filter(row => row.status === "failed").length;
  return (
    <section className="mb-6 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 space-y-4" aria-label="LinkedIn connection list">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">LinkedIn connections</h2>
          <p className="text-sm text-[var(--text-secondary)]">Paste profiles after sending your invitations. Start processing when you’re ready.</p>
          <p className="text-sm text-[var(--text-secondary)]">Processed leads are added below with LinkedIn marked Connection sent.</p>
        </div>
        <div className="flex gap-2">
          {active > 0 && <Button variant="outline" size="sm" disabled={busy} onClick={() => void control("pause")}>Pause waiting</Button>}
          <Button size="sm" disabled={busy || saved === 0} onClick={() => void control("start")}>Start processing{saved > 0 ? ` (${saved})` : ""}</Button>
        </div>
      </div>
      <p role="status" className="text-sm text-[var(--text-secondary)]">{loading ? "Loading saved URLs…" : `${saved} saved · ${active} processing · ${done} added${failed ? ` · ${failed} need attention` : ""}`}</p>
      {items.length > 0 && <ol className="max-h-72 overflow-y-auto divide-y divide-[var(--border-subtle)] border border-[var(--border-subtle)] rounded-md">
        {items.map((item, index) => <li key={item.id} className="px-3 py-2 space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-[var(--text-tertiary)]">{index + 1}.</span>
            <a href={item.linkedin_url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 break-all underline underline-offset-2">{item.linkedin_url.replace("https://www.linkedin.com/in/", "")}</a>
            <span>{QUEUE_LABELS[item.status]}</span>
            {item.status === "failed" && <Button size="sm" variant="outline" disabled={busy} onClick={() => void control("retry", item.id)}>Retry</Button>}
            {(item.status === "draft" || item.status === "failed") && <Button size="sm" variant="ghost" disabled={busy} aria-label={`Remove ${item.linkedin_url}`} onClick={() => void control("remove", item.id)}>Remove</Button>}
          </div>
          {item.error && <p className="text-sm text-destructive">{item.error}</p>}
        </li>)}
      </ol>}
      <form className="space-y-2" onSubmit={e => { e.preventDefault(); void save(text); }}>
        <Label htmlFor={`connection-urls-${avatarId}`}>Paste the next LinkedIn URL</Label>
        <Textarea id={`connection-urls-${avatarId}`} rows={2} disabled={busy} value={text} placeholder="https://www.linkedin.com/in/name" onChange={e => setText(e.target.value)}
          onPaste={e => { const pasted = e.clipboardData.getData("text"); e.preventDefault(); setText(pasted); void save(pasted); }} />
        <div className="flex flex-wrap justify-between gap-2 items-center">
          <p className="text-sm text-[var(--text-secondary)]">Pasted URLs save automatically. You can paste several, one per line. Processing uses Apify credits and continues if you close the tab.</p>
          {text.trim() && <Button size="sm" variant="outline" type="submit" disabled={busy}>{busy ? "Saving…" : "Save URLs"}</Button>}
        </div>
      </form>
      {notice && <p role="status" className="text-sm text-[var(--text-secondary)]">{notice}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
