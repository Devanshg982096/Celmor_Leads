"use client";

import { useState, useTransition } from "react";
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
import { updateLinkedInDmSettings } from "@/lib/settings/workspace-actions";
import type { LinkedInDmField } from "@/lib/types";

type Values = Record<LinkedInDmField, string>;

interface Props {
  initial: Values;
}

/** Order and copy for the five editable boxes. */
const BLOCKS: {
  field: LinkedInDmField;
  label: string;
  hint: string;
  rows: number;
}[] = [
  {
    field: "linkedin_dm_template",
    label: "First message",
    hint: "The message everyone gets. [NAME] becomes their first name, [OPENING] becomes the two personalised paragraphs.",
    rows: 14,
  },
  {
    field: "linkedin_followup_1",
    label: "Follow-up 1",
    hint: "Leave blank to skip this follow-up entirely.",
    rows: 8,
  },
  {
    field: "linkedin_followup_2",
    label: "Follow-up 2",
    hint: "Leave blank to skip this follow-up entirely.",
    rows: 8,
  },
  {
    field: "linkedin_followup_3",
    label: "Follow-up 3",
    hint: "Leave blank to skip this follow-up entirely.",
    rows: 8,
  },
  {
    field: "linkedin_dm_prompt",
    label: "Personalisation rules",
    hint: "How the personalised lines get written. Only change this if you want to change the writing style itself.",
    rows: 16,
  },
];

export default function LinkedInDmSection({ initial }: Props) {
  const [values, setValues] = useState<Values>(initial);
  const [saved, setSaved] = useState<Values>(initial);
  const [error, setError] = useState<string | null>(null);
  const [okFlash, setOkFlash] = useState(false);
  const [isSaving, startTransition] = useTransition();

  const dirtyFields = (Object.keys(values) as LinkedInDmField[]).filter(
    (f) => values[f] !== saved[f],
  );
  const dirty = dirtyFields.length > 0;

  function set(field: LinkedInDmField, next: string) {
    setValues((v) => ({ ...v, [field]: next }));
    setOkFlash(false);
    setError(null);
  }

  function save() {
    setError(null);
    setOkFlash(false);
    // Send only what changed, so an untouched box can't overwrite a value
    // someone else edited in the meantime.
    const patch = Object.fromEntries(dirtyFields.map((f) => [f, values[f]]));
    startTransition(async () => {
      const result = await updateLinkedInDmSettings(patch);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      setSaved(values);
      setOkFlash(true);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>LinkedIn DMs</CardTitle>
        <CardDescription>
          The fixed wording for your LinkedIn messages. Narada writes the
          personalised lines and drops them into these. Changes only affect
          messages written from now on, so anything already generated stays as
          it is.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {BLOCKS.map((block) => (
          <div key={block.field} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <Label htmlFor={block.field}>{block.label}</Label>
              {values[block.field] !== saved[block.field] && (
                <span className="text-[11px] text-[var(--text-tertiary)]">
                  unsaved
                </span>
              )}
            </div>
            <p className="text-xs text-[var(--text-secondary)]">{block.hint}</p>
            <Textarea
              id={block.field}
              value={values[block.field]}
              onChange={(e) => set(block.field, e.target.value)}
              rows={block.rows}
              className="font-mono text-xs"
              disabled={isSaving}
            />
          </div>
        ))}

        <div className="flex items-center gap-2 border-t pt-4">
          <Button onClick={save} disabled={!dirty || isSaving} size="sm">
            {isSaving
              ? "Saving…"
              : dirty
                ? `Save ${dirtyFields.length} change${dirtyFields.length === 1 ? "" : "s"}`
                : "Save changes"}
          </Button>
          {dirty && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setValues(saved);
                setError(null);
              }}
              disabled={isSaving}
            >
              Discard changes
            </Button>
          )}
          {okFlash && !dirty && (
            <span className="text-xs text-[var(--status-success)]">Saved</span>
          )}
        </div>

        {error && <p className="text-xs text-[var(--status-danger)]">{error}</p>}
      </CardContent>
    </Card>
  );
}
