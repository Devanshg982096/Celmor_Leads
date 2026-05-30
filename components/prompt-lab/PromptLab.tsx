"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { updateWorkspaceSetting } from "@/lib/settings/workspace-actions";
import {
  getPreviewSourcesAction,
  previewIcebreakerAction,
  type PreviewLead,
  type PreviewSources,
} from "@/lib/prompt-lab/actions";

interface Props {
  initialPrompt: string;
  leads: PreviewLead[];
}

export default function PromptLab({ initialPrompt, leads }: Props) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [savedPrompt, setSavedPrompt] = useState(initialPrompt);
  const [selectedId, setSelectedId] = useState<string | null>(
    leads.length > 0 ? leads[0].id : null,
  );
  const [sources, setSources] = useState<PreviewSources | null>(null);
  const [isLoadingSources, startLoadSources] = useTransition();
  const [preview, setPreview] = useState<{ subject: string; icebreaker: string } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isRunning, startRun] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [isSaving, startSave] = useTransition();

  const dirty = prompt !== savedPrompt;

  // Load sources for the selected lead so the user can see what the LLM sees.
  useEffect(() => {
    if (!selectedId) {
      setSources(null);
      return;
    }
    startLoadSources(async () => {
      const result = await getPreviewSourcesAction(selectedId);
      setSources(result);
    });
  }, [selectedId]);

  function runPreview() {
    if (!selectedId) return;
    setPreview(null);
    setPreviewError(null);
    startRun(async () => {
      const result = await previewIcebreakerAction(prompt, selectedId);
      if (!result.ok) {
        setPreviewError(result.error);
        return;
      }
      setPreview({ subject: result.subject, icebreaker: result.icebreaker });
    });
  }

  function savePrompt() {
    setSaveError(null);
    setSaveOk(false);
    startSave(async () => {
      const result = await updateWorkspaceSetting("icebreaker_prompt", prompt);
      if ("error" in result && result.error) {
        setSaveError(result.error);
        return;
      }
      setSavedPrompt(prompt);
      setSaveOk(true);
    });
  }

  if (leads.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No enriched leads yet</CardTitle>
          <CardDescription>
            Enrich at least one lead from the Emails tab so there&apos;s
            source material to preview against. The lab needs a real
            lead&apos;s website + LinkedIn summaries as input.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const selectedLead = leads.find((l) => l.id === selectedId) ?? null;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {/* LEFT: Prompt editor */}
      <Card>
        <CardHeader>
          <CardTitle>System prompt</CardTitle>
          <CardDescription>
            Used verbatim as Claude&apos;s system message. Edits here don&apos;t
            affect anything until you click <strong>Save as workspace prompt</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              setSaveOk(false);
            }}
            rows={22}
            className="font-mono text-xs"
            disabled={isRunning || isSaving}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={runPreview} disabled={isRunning || !selectedId}>
              {isRunning ? "Running…" : "Run preview"}
            </Button>
            <Button
              variant="outline"
              onClick={savePrompt}
              disabled={!dirty || isSaving}
            >
              {isSaving ? "Saving…" : "Save as workspace prompt"}
            </Button>
            {dirty && (
              <Button variant="ghost" onClick={() => setPrompt(savedPrompt)} disabled={isSaving}>
                Reset
              </Button>
            )}
            {saveOk && !dirty && (
              <span className="text-xs text-[var(--status-success)]">Saved</span>
            )}
          </div>
          {saveError && <p className="text-xs text-[var(--status-danger)]">{saveError}</p>}
        </CardContent>
      </Card>

      {/* RIGHT: Lead picker + preview */}
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Preview lead</CardTitle>
            <CardDescription>
              Output depends on the lead&apos;s saved Apify summaries.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="lead-select">Lead</Label>
              <select
                id="lead-select"
                value={selectedId ?? ""}
                onChange={(e) => setSelectedId(e.target.value || null)}
                disabled={isRunning}
                className="h-9 w-full rounded-md border border-[var(--border-default)] bg-[var(--bg-overlay)] px-2 text-sm text-[var(--text-primary)]"
              >
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                    {l.company ? ` · ${l.company}` : ""}
                    {l.has_website && l.has_linkedin
                      ? " (web+li)"
                      : l.has_website
                        ? " (web)"
                        : " (li)"}
                  </option>
                ))}
              </select>
            </div>

            {selectedLead && (
              <div className="text-[12px] text-[var(--text-tertiary)]">
                {selectedLead.title ?? "—"}
              </div>
            )}

            {isLoadingSources ? (
              <p className="text-[12px] text-[var(--text-tertiary)]">Loading sources…</p>
            ) : sources ? (
              <div className="space-y-2">
                {sources.website_summary && (
                  <details className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-overlay)]">
                    <summary className="cursor-pointer px-3 py-1.5 text-[12.5px] text-[var(--text-secondary)]">
                      Website summary — {sources.website_summary.length} chars
                    </summary>
                    <pre className="border-t border-[var(--border-subtle)] px-3 py-2 whitespace-pre-wrap break-words font-mono text-[11.5px] text-[var(--text-secondary)] max-h-60 overflow-y-auto">
                      {sources.website_summary}
                    </pre>
                  </details>
                )}
                {sources.linkedin_summary && (
                  <details className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-overlay)]">
                    <summary className="cursor-pointer px-3 py-1.5 text-[12.5px] text-[var(--text-secondary)]">
                      LinkedIn summary — {sources.linkedin_summary.length} chars
                    </summary>
                    <pre className="border-t border-[var(--border-subtle)] px-3 py-2 whitespace-pre-wrap break-words font-mono text-[11.5px] text-[var(--text-secondary)] max-h-60 overflow-y-auto">
                      {sources.linkedin_summary}
                    </pre>
                  </details>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Preview output</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isRunning && (
              <p className="text-[13px] text-[var(--text-tertiary)]">
                Calling Claude with your prompt…
              </p>
            )}
            {previewError && (
              <p className="text-[13px] text-[var(--status-danger)]">{previewError}</p>
            )}
            {preview ? (
              <div className="space-y-2">
                <div>
                  <p className="text-[10.5px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                    Subject
                  </p>
                  <p className="text-[13px] text-[var(--text-primary)]">
                    {preview.subject}
                  </p>
                </div>
                <div>
                  <p className="text-[10.5px] uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
                    Opener
                  </p>
                  <p className="whitespace-pre-wrap text-[13px] text-[var(--text-primary)]">
                    {preview.icebreaker}
                  </p>
                </div>
              </div>
            ) : !isRunning && !previewError ? (
              <p className="text-[13px] text-[var(--text-tertiary)]">
                Hit <strong>Run preview</strong> to see what this prompt produces.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
