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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  testWorkspaceKey,
  updateWorkspaceSetting,
} from "@/lib/settings/workspace-actions";

interface Props {
  smartleadKeyPresent: boolean;
  anthropicKeyPresent: boolean;
  apifyTokenPresent: boolean;
}

type FieldKey = "smartlead_api_key" | "anthropic_api_key" | "apify_token";

interface FieldDef {
  key: FieldKey;
  label: string;
  hint: string;
  placeholder: string;
}

const FIELDS: FieldDef[] = [
  {
    key: "smartlead_api_key",
    label: "Smartlead API key",
    hint: "Used to list campaigns, push leads, and sync status.",
    placeholder: "Get yours at app.smartlead.ai → Settings → API Keys",
  },
  {
    key: "anthropic_api_key",
    label: "Anthropic API key",
    hint: "Used to generate subject lines + icebreakers.",
    placeholder: "sk-ant-…",
  },
  {
    key: "apify_token",
    label: "Apify token",
    hint: "Used to crawl websites and scrape LinkedIn profiles.",
    placeholder: "apify_api_…",
  },
];

export default function IntegrationsSection({
  smartleadKeyPresent,
  anthropicKeyPresent,
  apifyTokenPresent,
}: Props) {
  const present: Record<FieldKey, boolean> = {
    smartlead_api_key: smartleadKeyPresent,
    anthropic_api_key: anthropicKeyPresent,
    apify_token: apifyTokenPresent,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Integrations</CardTitle>
        <CardDescription>
          External services Narada uses. Keys are stored encrypted at the database level and never exposed to the browser once saved.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {FIELDS.map((field) => (
          <SecretField
            key={field.key}
            field={field}
            isSet={present[field.key]}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function SecretField({ field, isSet }: { field: FieldDef; isSet: boolean }) {
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(isSet);
  const [editing, setEditing] = useState(!isSet);
  const [error, setError] = useState<string | null>(null);
  const [okFlash, setOkFlash] = useState(false);
  const [isSaving, startTransition] = useTransition();
  const [testResult, setTestResult] = useState<{ ok: boolean; detail: string } | null>(null);
  const [isTesting, startTestTransition] = useTransition();

  function runTest() {
    setTestResult(null);
    startTestTransition(async () => {
      const result = await testWorkspaceKey(field.key);
      setTestResult(result);
    });
  }

  function save() {
    setError(null);
    setOkFlash(false);
    startTransition(async () => {
      const result = await updateWorkspaceSetting(field.key, value);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
      setEditing(false);
      setValue("");
      setOkFlash(true);
    });
  }

  function clear() {
    setError(null);
    startTransition(async () => {
      const result = await updateWorkspaceSetting(field.key, "");
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      setSaved(false);
      setEditing(true);
      setValue("");
    });
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={field.key}>{field.label}</Label>
      <div className="flex items-center gap-2">
        {editing ? (
          <Input
            id={field.key}
            type="password"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setOkFlash(false);
            }}
            placeholder={field.placeholder}
            disabled={isSaving}
            autoComplete="off"
            className="max-w-md"
          />
        ) : (
          <Input
            id={field.key}
            value="•••••••••••••••••• (saved)"
            readOnly
            disabled
            className="max-w-md"
          />
        )}
        {editing ? (
          <>
            <Button
              size="sm"
              onClick={save}
              disabled={isSaving || value.trim().length === 0}
            >
              {isSaving ? "Saving…" : "Save"}
            </Button>
            {saved && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setValue("");
                  setError(null);
                }}
                disabled={isSaving}
              >
                Cancel
              </Button>
            )}
          </>
        ) : (
          <>
            <Button
              size="sm"
              variant="outline"
              onClick={runTest}
              disabled={isTesting}
            >
              {isTesting ? "Testing…" : "Test"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              Replace
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={clear}
              disabled={isSaving}
            >
              Clear
            </Button>
          </>
        )}
        {okFlash && !editing && (
          <span className="text-xs text-[var(--status-success)]">Saved</span>
        )}
      </div>
      <p className="text-xs text-[var(--text-secondary)]">{field.hint}</p>
      {error && <p className="text-xs text-[var(--status-danger)]">{error}</p>}
      {testResult && (
        <p
          className={
            "text-xs " +
            (testResult.ok
              ? "text-[var(--status-success)]"
              : "text-[var(--status-danger)]")
          }
        >
          {testResult.ok ? "✓ " : "✗ "}
          {testResult.detail}
        </p>
      )}
    </div>
  );
}
