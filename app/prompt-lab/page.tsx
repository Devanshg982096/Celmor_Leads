import AppShell from "@/components/layout/AppShell";
import PromptLab from "@/components/prompt-lab/PromptLab";
import { getWorkspaceSettings } from "@/lib/settings/workspace-actions";
import { listLeadsForPreviewAction } from "@/lib/prompt-lab/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Prompt lab — Narada" };

export default async function PromptLabPage() {
  const [ws, leads] = await Promise.all([
    getWorkspaceSettings(),
    listLeadsForPreviewAction(),
  ]);

  return (
    <AppShell breadcrumb={[{ label: "Prompt lab" }]}>
      <div className="max-w-5xl space-y-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[var(--text-primary)]">
            Icebreaker prompt lab
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Tweak the system prompt and preview the output against a real lead
            without affecting anything saved. Save the prompt to apply it to
            every future enrichment.
          </p>
        </div>
        <PromptLab
          initialPrompt={ws?.icebreaker_prompt ?? ""}
          leads={leads}
        />
      </div>
    </AppShell>
  );
}
