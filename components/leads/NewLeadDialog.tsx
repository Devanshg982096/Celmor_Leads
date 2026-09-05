"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PROFILE_FIELDS, type ProfileDraft } from "@/lib/leads/profile-import";
import { startProfileImport, pollProfileImport, saveProfileImport } from "@/lib/leads/profile-import-actions";

export default function NewLeadDialog({ avatarId }: { avatarId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [ticket, setTicket] = useState("");
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [cost, setCost] = useState<number | undefined>();
  const [success, setSuccess] = useState("");
  const epoch = useRef(0);

  useEffect(() => {
    if (!ticket || !polling || !open) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    async function check() {
      try {
        const result = await pollProfileImport(avatarId, ticket);
        if (stopped) return;
        if (result.error) { setError(result.error); setPolling(false); return; }
        if (result.draft) {
          setDraft(result.draft);
          setCost(result.cost);
          setWarning(result.duplicates?.length ? "A matching lead already exists in an Avatar. Saving will check for duplicates in this Avatar." : "");
          setPolling(false);
          return;
        }
        if (++attempts >= 60) {
          setError("The lookup is taking longer than usual. Check again in a moment; this resumes the same lookup.");
          setPolling(false);
          return;
        }
        timer = setTimeout(check, 3000);
      } catch {
        if (!stopped) { setError("Connection interrupted. Check again to resume this lookup."); setPolling(false); }
      }
    }
    void check();
    return () => { stopped = true; clearTimeout(timer); };
  }, [avatarId, ticket, polling, open]);

  function reset() {
    epoch.current++;
    setTicket(""); setDraft(null); setError(""); setWarning(""); setCost(undefined); setPolling(false);
  }

  async function fetchProfile() {
    reset(); setBusy(true); setSuccess("");
    const request = epoch.current;
    try {
      const result = await startProfileImport(avatarId, url);
      if (request !== epoch.current) return;
      if (result.error) setError(result.error);
      else if (result.ticket) { setTicket(result.ticket); setUrl(result.url); setPolling(true); }
    } catch { setError("Could not start the lookup. Please try again."); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!draft) return;
    setBusy(true); setError("");
    try {
      const result = await saveProfileImport(avatarId, ticket, draft);
      if (result.error) setError(result.error);
      else {
        setSuccess(`${draft.name} added.`);
        setOpen(false); reset(); setUrl(""); router.refresh();
      }
    } catch { setError("Could not save. Your details are still here; please try again."); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <Dialog open={open} onOpenChange={value => { if (!busy) { setOpen(value); if (value && ticket && !draft) setPolling(true); } }}>
        <DialogTrigger render={<Button size="sm" />}><Plus className="size-4" />New lead</DialogTrigger>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto" showCloseButton={!busy}>
          <DialogHeader>
            <DialogTitle>New lead from LinkedIn</DialogTitle>
            <DialogDescription>Fetch a profile with Apify, review the details, then add it to this Avatar.</DialogDescription>
          </DialogHeader>
          {!draft ? (
            <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (!busy && !ticket) void fetchProfile(); }}>
              <div className="space-y-2">
                <Label htmlFor={`profile-url-${avatarId}`}>LinkedIn profile URL</Label>
                <Input id={`profile-url-${avatarId}`} value={url} onChange={e => setUrl(e.target.value)} disabled={busy || !!ticket} placeholder="https://www.linkedin.com/in/name" required />
              </div>
              <p className="text-sm text-muted-foreground">Uses your existing Apify credits. Email and phone are included only when found.</p>
              {polling && <p role="status" className="text-sm">Fetching profile details… You can close this dialog and reopen it to check the result.</p>}
              {!ticket && <Button type="submit" disabled={busy || !url.trim()}>{busy ? "Starting lookup…" : "Find details"}</Button>}
              {ticket && <div className="flex gap-2">
                <Button type="button" disabled={polling} onClick={() => { setError(""); setPolling(true); }}>Check again</Button>
                <Button type="button" variant="outline" disabled={polling} onClick={reset}>Use another URL</Button>
              </div>}
            </form>
          ) : (
            <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (!busy) void save(); }}>
              <p className="text-sm break-all">Source: <a className="underline" href={url} target="_blank" rel="noreferrer">LinkedIn profile</a></p>
              <p className="text-sm text-muted-foreground">Review these details before saving. Blank fields were not found. Email addresses have not been independently verified.</p>
              {warning && <p role="status" className="text-sm text-[var(--status-warning)]">{warning}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PROFILE_FIELDS.map(([key, label]) => <div className="space-y-1.5" key={key}>
                  <Label htmlFor={`profile-${avatarId}-${key}`}>{label}</Label>
                  <Input id={`profile-${avatarId}-${key}`} value={draft[key]} type={key === "email" ? "email" : "text"} required={key === "name"} disabled={busy} placeholder="Not found" onChange={e => setDraft({ ...draft, [key]: e.target.value })} />
                </div>)}
              </div>
              {cost !== undefined && <p className="text-sm text-muted-foreground">Apify lookup cost: ${cost.toFixed(4)}</p>}
              <div className="flex justify-between gap-3">
                <Button type="button" variant="outline" disabled={busy} onClick={reset}>Use another URL</Button>
                <Button type="submit" disabled={busy}>{busy ? "Adding…" : "Add lead"}</Button>
              </div>
            </form>
          )}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </DialogContent>
      </Dialog>
      {success && <span role="status" className="text-sm text-muted-foreground">{success}</span>}
    </div>
  );
}
