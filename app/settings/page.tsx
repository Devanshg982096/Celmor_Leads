import AppShell from "@/components/layout/AppShell";
import ProfileSection from "@/components/settings/ProfileSection";
import AppearanceSection from "@/components/settings/AppearanceSection";
import WorkspaceSection from "@/components/settings/WorkspaceSection";
import IntegrationsSection from "@/components/settings/IntegrationsSection";
import IcebreakerPromptSection from "@/components/settings/IcebreakerPromptSection";
import SignOutSection from "@/components/settings/SignOutSection";
import { createClient } from "@/lib/supabase/server";
import { listProfiles } from "@/lib/avatars/leads-actions";
import { getWorkspaceSettings } from "@/lib/settings/workspace-actions";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings — Narada" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [profiles, ws] = await Promise.all([
    listProfiles(),
    getWorkspaceSettings(),
  ]);
  const myProfile: Profile | null =
    user ? profiles.find((p) => p.id === user.id) ?? null : null;

  const displayName = myProfile?.display_name ?? user?.email ?? "—";
  const email = user?.email ?? "—";

  return (
    <AppShell breadcrumb={[{ label: "Settings" }]}>
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-[var(--text-primary)]">
            Settings
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Manage your profile, appearance, and workspace.
          </p>
        </div>

        <ProfileSection displayName={displayName} email={email} />
        <AppearanceSection />
        <WorkspaceSection members={profiles} currentUserId={user?.id ?? ""} />
        <IntegrationsSection
          smartleadKeyPresent={!!ws?.smartlead_api_key}
          anthropicKeyPresent={!!ws?.anthropic_api_key}
          apifyTokenPresent={!!ws?.apify_token}
        />
        <IcebreakerPromptSection initialPrompt={ws?.icebreaker_prompt ?? ""} />
        <SignOutSection />
      </div>
    </AppShell>
  );
}
