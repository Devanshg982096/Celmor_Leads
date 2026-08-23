import AppShell from "@/components/layout/AppShell";
import LinkedInPromptLab from "@/components/prompt-lab/LinkedInPromptLab";
import { getWorkspaceSettings } from "@/lib/settings/workspace-actions";
import { listLabAvatars } from "@/lib/prompt-lab/linkedin-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "LinkedIn lab — Narada" };

export default async function LinkedInPromptLabPage() {
  const [ws, avatars] = await Promise.all([
    getWorkspaceSettings(),
    listLabAvatars(),
  ]);

  return (
    <AppShell breadcrumb={[{ label: "LinkedIn lab" }]}>
      <div className="max-w-5xl space-y-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[var(--text-primary)]">
            LinkedIn DM lab
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            The wording for your LinkedIn messages, and a way to see how all
            four read for a real person before you run a whole campaign.
          </p>
        </div>
        <LinkedInPromptLab
          avatars={avatars}
          initial={{
            linkedin_dm_template: ws?.linkedin_dm_template ?? "",
            linkedin_followup_1: ws?.linkedin_followup_1 ?? "",
            linkedin_followup_2: ws?.linkedin_followup_2 ?? "",
            linkedin_followup_3: ws?.linkedin_followup_3 ?? "",
            linkedin_dm_prompt: ws?.linkedin_dm_prompt ?? "",
          }}
        />
      </div>
    </AppShell>
  );
}
