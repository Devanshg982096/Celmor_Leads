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
import { updateWorkspaceSetting } from "@/lib/settings/workspace-actions";

interface Props {
  initialPrompt: string;
}

export default function IcebreakerPromptSection({ initialPrompt }: Props) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [saved, setSaved] = useState(initialPrompt);
  const [error, setError] = useState<string | null>(null);
  const [okFlash, setOkFlash] = useState(false);
  const [isSaving, startTransition] = useTransition();

  const dirty = prompt !== saved;

  function save() {
    setError(null);
    setOkFlash(false);
    startTransition(async () => {
      const result = await updateWorkspaceSetting("icebreaker_prompt", prompt);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      setSaved(prompt);
      setOkFlash(true);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Icebreaker prompt</CardTitle>
        <CardDescription>
          Controls how Claude writes the subject line and icebreaker for each lead. Edits apply to all future enrichments.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            setOkFlash(false);
          }}
          rows={16}
          className="font-mono text-xs"
          disabled={isSaving}
        />
        <div className="flex items-center gap-2">
          <Button onClick={save} disabled={!dirty || isSaving} size="sm">
            {isSaving ? "Saving…" : "Save prompt"}
          </Button>
          {dirty && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPrompt(saved)}
              disabled={isSaving}
            >
              Reset
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
