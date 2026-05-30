"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { saveSequenceAction } from "@/lib/smartlead/actions";
import type {
  SequenceStepInput,
  SmartleadSequenceStep,
} from "@/lib/smartlead/client";

interface Props {
  campaignId: number;
  initial: SmartleadSequenceStep[];
  onClose: () => void;
  onSaved: (steps: SmartleadSequenceStep[]) => void;
}

interface DraftStep {
  subject: string;
  email_body: string;
  delay_in_days: number;
}

function stepsFromInitial(initial: SmartleadSequenceStep[]): DraftStep[] {
  if (initial.length === 0) {
    // Start a brand-new campaign with a sensible default.
    return [
      {
        subject: "{{subject_line}}",
        email_body:
          "Hi {{first_name|fallback:there}},\n\n{{icebreaker}}\n\nWould you be open to a short chat next week?\n\nKind regards,\n",
        delay_in_days: 0,
      },
    ];
  }
  return initial.map((s) => ({
    subject: s.subject ?? "",
    email_body: s.email_body ?? "",
    delay_in_days: s.seq_delay_details?.delay_in_days ?? 0,
  }));
}

export default function SequenceEditor({
  campaignId,
  initial,
  onClose,
  onSaved,
}: Props) {
  const [steps, setSteps] = useState<DraftStep[]>(() => stepsFromInitial(initial));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();

  useEffect(() => {
    setSteps(stepsFromInitial(initial));
  }, [initial, campaignId]);

  function patch(index: number, patchObj: Partial<DraftStep>) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patchObj } : s)));
  }

  function addStep() {
    setSteps((prev) => [
      ...prev,
      {
        subject: prev.length === 0 ? "{{subject_line}}" : "",
        email_body: "",
        delay_in_days: prev.length === 0 ? 0 : 3,
      },
    ]);
  }

  function removeStep(index: number) {
    setSteps((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  function move(index: number, dir: -1 | 1) {
    setSteps((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function save() {
    setError(null);
    const payload: SequenceStepInput[] = steps.map((s, i) => ({
      seq_number: i + 1,
      subject: s.subject.trim(),
      email_body: s.email_body,
      delay_in_days: Number.isFinite(s.delay_in_days) ? Math.max(0, s.delay_in_days) : 0,
    }));
    startSave(async () => {
      const result = await saveSequenceAction(campaignId, payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      // Round-trip a SmartleadSequenceStep[] shape so the parent view re-renders.
      onSaved(
        payload.map((p) => ({
          seq_number: p.seq_number,
          subject: p.subject,
          email_body: p.email_body,
          seq_delay_details: { delay_in_days: p.delay_in_days },
        })),
      );
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--text-tertiary)]">
          Sequence editor
        </h3>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button size="sm" onClick={save} disabled={isSaving}>
            {isSaving ? "Saving…" : "Save sequence"}
          </Button>
        </div>
      </div>

      <ol className="space-y-3">
        {steps.map((step, i) => (
          <li
            key={i}
            className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-overlay)] px-3 py-3"
          >
            <div className="mb-2 flex items-center justify-between gap-2 text-[11px] text-[var(--text-tertiary)]">
              <span className="font-medium uppercase tracking-[0.06em]">
                Step {i + 1}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0 || isSaving}
                  className="rounded px-1.5 py-0.5 hover:bg-[var(--bg-hover)] disabled:opacity-40"
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === steps.length - 1 || isSaving}
                  className="rounded px-1.5 py-0.5 hover:bg-[var(--bg-hover)] disabled:opacity-40"
                  title="Move down"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => removeStep(i)}
                  disabled={steps.length === 1 || isSaving}
                  className="rounded px-1.5 py-0.5 hover:bg-[var(--bg-hover)] disabled:opacity-40"
                  title="Remove step"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="grid grid-cols-[1fr_120px] gap-2 mb-2">
              <div className="space-y-1">
                <Label htmlFor={`subject-${i}`} className="text-[11px]">
                  Subject {i === 0 ? "" : "(blank = follow-up in same thread)"}
                </Label>
                <Input
                  id={`subject-${i}`}
                  value={step.subject}
                  onChange={(e) => patch(i, { subject: e.target.value })}
                  placeholder={i === 0 ? "{{subject_line}}" : "(leave blank for thread reply)"}
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`delay-${i}`} className="text-[11px]">
                  Wait days
                </Label>
                <Input
                  id={`delay-${i}`}
                  type="number"
                  min={0}
                  value={step.delay_in_days}
                  onChange={(e) =>
                    patch(i, { delay_in_days: Number(e.target.value) || 0 })
                  }
                  disabled={isSaving || i === 0}
                  title={i === 0 ? "Step 1 always sends immediately" : undefined}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor={`body-${i}`} className="text-[11px]">
                Body — supports {`{{first_name}}, {{icebreaker}}, {{subject_line}}, {{company_name}}`}
              </Label>
              <Textarea
                id={`body-${i}`}
                rows={8}
                value={step.email_body}
                onChange={(e) => patch(i, { email_body: e.target.value })}
                placeholder="Hi {{first_name|fallback:there}},&#10;&#10;{{icebreaker}}&#10;&#10;..."
                disabled={isSaving}
                className="font-mono text-[12.5px]"
              />
            </div>
          </li>
        ))}
      </ol>

      <Button variant="outline" size="sm" onClick={addStep} disabled={isSaving}>
        + Add step
      </Button>

      {error && <p className="text-[13px] text-[var(--status-danger)]">{error}</p>}

      <p className="text-[11px] text-[var(--text-tertiary)]">
        Smartlead delivers step 1 immediately, then waits the specified days
        before each follow-up. Follow-ups with a blank subject thread the reply.
      </p>
    </section>
  );
}
