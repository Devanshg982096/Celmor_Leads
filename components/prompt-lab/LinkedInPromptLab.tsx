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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listLabLeads,
  previewLinkedInDmAction,
  saveAvatarWording,
  type LabAvatar,
  type LabLead,
  type LabPreview,
} from "@/lib/prompt-lab/linkedin-actions";
import type { LinkedInDmField } from "@/lib/types";

type Values = Record<LinkedInDmField, string>;

const BLANK: Values = {
  linkedin_dm_prompt: "",
  linkedin_dm_template: "",
  linkedin_followup_1: "",
  linkedin_followup_2: "",
  linkedin_followup_3: "",
};

interface Props {
  avatars: LabAvatar[];
}

const BLOCKS: { field: LinkedInDmField; label: string; hint: string; rows: number }[] = [
  {
    field: "linkedin_dm_template",
    label: "First message",
    hint: "[NAME] becomes their first name. [OPENING] becomes the two personalised paragraphs.",
    rows: 13,
  },
  { field: "linkedin_followup_1", label: "Follow-up 1", hint: "Leave blank to skip it.", rows: 7 },
  { field: "linkedin_followup_2", label: "Follow-up 2", hint: "Leave blank to skip it.", rows: 7 },
  { field: "linkedin_followup_3", label: "Follow-up 3", hint: "Leave blank to skip it.", rows: 7 },
];

export default function LinkedInPromptLab({ avatars }: Props) {
  const [avatarId, setAvatarId] = useState<string>(avatars[0]?.id ?? "");

  // The wording belongs to the campaign, so switching campaign swaps the whole
  // lab. Edits are kept per campaign until saved, so flicking between the two
  // to compare wording does not throw away what you have typed.
  const [drafts, setDrafts] = useState<Record<string, Values>>(() =>
    Object.fromEntries(avatars.map((a) => [a.id, { ...a.wording }])),
  );
  const [saved, setSaved] = useState<Record<string, Values>>(() =>
    Object.fromEntries(avatars.map((a) => [a.id, { ...a.wording }])),
  );
  const values = drafts[avatarId] ?? BLANK;
  const savedValues = saved[avatarId] ?? BLANK;

  const [leads, setLeads] = useState<LabLead[]>([]);
  const [leadId, setLeadId] = useState<string>("");
  const [loadingLeads, startLoadLeads] = useTransition();

  const [preview, setPreview] = useState<LabPreview | null>(null);
  const [running, startRun] = useTransition();
  const [showSource, setShowSource] = useState(false);

  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [saving, startSave] = useTransition();

  const dirtyFields = (Object.keys(values) as LinkedInDmField[]).filter(
    (f) => values[f] !== savedValues[f],
  );
  const dirty = dirtyFields.length > 0;

  // Campaigns with unsaved edits you have not come back to yet.
  const otherUnsaved = avatars.filter(
    (a) =>
      a.id !== avatarId &&
      (Object.keys(BLANK) as LinkedInDmField[]).some(
        (f) => (drafts[a.id] ?? BLANK)[f] !== (saved[a.id] ?? BLANK)[f],
      ),
  );

  // Reload the lead list whenever the campaign changes.
  useEffect(() => {
    if (!avatarId) return;
    startLoadLeads(async () => {
      const rows = await listLabLeads(avatarId);
      setLeads(rows);
      setLeadId(rows[0]?.id ?? "");
      setPreview(null);
    });
  }, [avatarId]);

  function set(field: LinkedInDmField, next: string) {
    setDrafts((d) => ({
      ...d,
      [avatarId]: { ...(d[avatarId] ?? BLANK), [field]: next },
    }));
    setSaveOk(false);
    setSaveError(null);
  }

  function run() {
    if (!leadId) return;
    setPreview(null);
    startRun(async () => {
      const result = await previewLinkedInDmAction(
        values.linkedin_dm_prompt,
        {
          first: values.linkedin_dm_template,
          followup_1: values.linkedin_followup_1,
          followup_2: values.linkedin_followup_2,
          followup_3: values.linkedin_followup_3,
        },
        leadId,
      );
      setPreview(result);
    });
  }

  function save() {
    setSaveError(null);
    setSaveOk(false);
    const patch = Object.fromEntries(dirtyFields.map((f) => [f, values[f]]));
    const target = avatarId;
    startSave(async () => {
      const result = await saveAvatarWording(target, patch);
      if ("error" in result && result.error) {
        setSaveError(result.error);
        return;
      }
      setSaved((prev) => ({ ...prev, [target]: { ...(drafts[target] ?? BLANK) } }));
      setSaveOk(true);
    });
  }

  const selectedLead = leads.find((l) => l.id === leadId) ?? null;

  if (avatars.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No campaigns yet</CardTitle>
          <CardDescription>
            Create an avatar and import some leads first, then come back here to
            try the wording against a real person.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const current = avatars.find((a) => a.id === avatarId) ?? null;

  return (
    <div className="space-y-4">
      {/* Which campaign's wording you are editing. Everything below follows this. */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-6">
          <div className="space-y-1.5">
            <Label>Campaign</Label>
            <Select value={avatarId} onValueChange={(v) => setAvatarId(v ?? avatarId)}>
              <SelectTrigger className="w-72">
                <SelectValue placeholder="Pick a campaign" />
              </SelectTrigger>
              <SelectContent>
                {avatars.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} ({a.leadCount.toLocaleString("en-GB")})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="pb-2 text-[12px] text-[var(--text-secondary)]">
            The messages and rules below belong to{" "}
            <span className="font-medium text-[var(--text-primary)]">
              {current?.name ?? "this campaign"}
            </span>
            . Other campaigns are untouched by anything you save here.
          </p>
        </CardContent>
      </Card>

      {/* Try it on a real lead */}
      <Card>
        <CardHeader>
          <CardTitle>Try it on a real lead</CardTitle>
          <CardDescription>
            Writes all four messages for one person using the wording below,
            including any unsaved edits. Nothing is saved to the lead, this is
            just to see how it reads.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label>Lead</Label>
              <Select
                value={leadId}
                onValueChange={(v) => {
                  setLeadId(v ?? leadId);
                  setPreview(null);
                }}
                disabled={loadingLeads || leads.length === 0}
              >
                <SelectTrigger className="w-72">
                  <SelectValue placeholder={loadingLeads ? "Loading…" : "Pick a lead"} />
                </SelectTrigger>
                <SelectContent>
                  {leads.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.hasSource ? "" : "○ "}
                      {l.name}
                      {l.company ? ` — ${l.company}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={run} disabled={!leadId || running} size="sm">
              {running ? "Writing…" : "Write the four messages"}
            </Button>
          </div>

          {selectedLead && !selectedLead.hasSource && (
            <p className="text-[12px] text-[var(--text-tertiary)]">
              This lead has not been scraped yet, so the message will only have
              their job title and firm to work from. Useful for seeing the worst
              case. Leads marked with a circle are in the same position.
            </p>
          )}

          {leads.length === 0 && !loadingLeads && (
            <p className="text-[12px] text-[var(--text-tertiary)]">
              No qualified leads with a LinkedIn URL in this campaign.
            </p>
          )}

          {preview && !preview.ok && (
            <p className="text-[12px] text-[var(--status-danger)]">{preview.error}</p>
          )}

          {preview && preview.ok && (
            <div className="space-y-3 border-t border-[var(--border-subtle)] pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-medium text-[var(--text-primary)]">
                  {preview.lead.name}
                  {preview.lead.company ? ` · ${preview.lead.company}` : ""}
                </span>
                {preview.quality === "thin" && (
                  <span className="rounded bg-[var(--bg-overlay)] px-1.5 py-0.5 text-[10px] text-[var(--text-tertiary)]">
                    Thin, little to work with
                  </span>
                )}
                {!preview.isAccountingFirm && (
                  <span className="rounded bg-[var(--status-danger)]/15 px-1.5 py-0.5 text-[10px] text-[var(--status-danger)]">
                    May not be an accountant
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowSource((s) => !s)}
                  className="ml-auto text-[11px] text-[var(--text-tertiary)] underline underline-offset-2"
                >
                  {showSource ? "Hide" : "Show"} what the AI was given
                </button>
              </div>

              {showSource && (
                <pre className="max-h-[300px] overflow-y-auto whitespace-pre-wrap rounded border border-[var(--border-subtle)] bg-[var(--bg-base)] p-2 font-mono text-[11px] text-[var(--text-secondary)]">
                  {preview.sourceBlock}
                </pre>
              )}

              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {preview.messages.map((m) => (
                  <div
                    key={m.slot}
                    className="rounded border border-[var(--border-subtle)] bg-[var(--bg-base)] p-3"
                  >
                    <div className="mb-1.5 flex items-center gap-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--accent-soft)]">
                        {m.label}
                      </p>
                      {m.fixedOnly && (
                        <span className="text-[10px] text-[var(--text-tertiary)]">
                          no personalised line
                        </span>
                      )}
                    </div>
                    {m.missingTemplate ? (
                      <p className="text-[12px] text-[var(--text-tertiary)]">
                        No wording set for this one, so it would be skipped.
                      </p>
                    ) : (
                      <pre className="whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-[var(--text-primary)]">
                        {m.text}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* The wording */}
      <Card>
        <CardHeader>
          <CardTitle>The messages</CardTitle>
          <CardDescription>
            The fixed wording everyone in this campaign gets. Saving applies it
            to every lead straight away, including ones already written, because
            only the personalised lines are stored per person.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {BLOCKS.map((b) => (
            <div key={b.field} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <Label htmlFor={b.field}>{b.label}</Label>
                {values[b.field] !== savedValues[b.field] && (
                  <span className="text-[11px] text-[var(--text-tertiary)]">unsaved</span>
                )}
              </div>
              <p className="text-xs text-[var(--text-secondary)]">{b.hint}</p>
              <Textarea
                id={b.field}
                value={values[b.field]}
                onChange={(e) => set(b.field, e.target.value)}
                rows={b.rows}
                className="font-mono text-xs"
                disabled={saving}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* The rules */}
      <Card>
        <CardHeader>
          <CardTitle>Writing rules</CardTitle>
          <CardDescription>
            How the personalised lines get written for this campaign. The output
            format is fixed in code, so you can rewrite this freely without
            breaking anything.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={values.linkedin_dm_prompt}
            onChange={(e) => set("linkedin_dm_prompt", e.target.value)}
            rows={20}
            className="font-mono text-xs"
            disabled={saving}
          />
        </CardContent>
      </Card>

      {/* Save bar, sticky so it is reachable from anywhere in a long page */}
      <div className="sticky bottom-0 flex items-center gap-2 rounded-md border border-[var(--border-default)] bg-[var(--bg-elevated)] p-3">
        <Button onClick={save} disabled={!dirty || saving} size="sm">
          {saving
            ? "Saving…"
            : dirty
              ? `Save ${dirtyFields.length} change${dirtyFields.length === 1 ? "" : "s"} to ${current?.name ?? "this campaign"}`
              : "Save changes"}
        </Button>
        {dirty && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDrafts((d) => ({ ...d, [avatarId]: { ...savedValues } }));
              setSaveError(null);
            }}
            disabled={saving}
          >
            Discard changes
          </Button>
        )}
        {saveOk && !dirty && (
          <span className="text-xs text-[var(--status-success)]">Saved</span>
        )}
        {saveError && (
          <span className="text-xs text-[var(--status-danger)]">{saveError}</span>
        )}
        {otherUnsaved.length > 0 && (
          <span className="ml-auto text-xs text-[var(--text-tertiary)]">
            Unsaved edits also in {otherUnsaved.map((a) => a.name).join(", ")}
          </span>
        )}
      </div>
    </div>
  );
}
