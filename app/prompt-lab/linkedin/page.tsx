import AppShell from "@/components/layout/AppShell";
import LinkedInPromptLab from "@/components/prompt-lab/LinkedInPromptLab";
import { listLabAvatars } from "@/lib/prompt-lab/linkedin-actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "LinkedIn lab — Narada" };

export default async function LinkedInPromptLabPage() {
  const avatars = await listLabAvatars();

  return (
    <AppShell breadcrumb={[{ label: "LinkedIn lab" }]}>
      <div className="max-w-5xl space-y-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[var(--text-primary)]">
            LinkedIn DM lab
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Each campaign has its own messages and its own writing rules. Pick a
            campaign to work on its wording, and try all four messages on a real
            person before you run the whole list.
          </p>
        </div>
        <LinkedInPromptLab avatars={avatars} />
      </div>
    </AppShell>
  );
}
