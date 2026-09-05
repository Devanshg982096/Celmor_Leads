import { notFound } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import ChannelHeader from "@/components/channels/ChannelHeader";
import LinkedInView from "@/components/channels/LinkedInView";
import ChannelTabs from "@/components/avatars/ChannelTabs";
import HandoverDialog from "@/components/channels/HandoverDialog";
import { createClient } from "@/lib/supabase/server";
import { listProfiles } from "@/lib/avatars/leads-actions";
import {
  getChannelLeads,
  listAvatarsForSwitcher,
} from "@/lib/avatars/channel-queries";
import { getWorkspaceSettings } from "@/lib/settings/workspace-actions";
import { getDmProgress } from "@/lib/leads/linkedin-dm-actions";
import type { Avatar } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LinkedInChannelPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ my?: string }>;
}) {
  const { id } = await params;
  const { my } = await searchParams;
  const myLeadsOnly = my !== "0";

  const supabase = await createClient();
  const { data: avatarRow } = await supabase
    .from("avatars")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!avatarRow) notFound();
  const avatar = avatarRow as Avatar;

  const [{ data: userData }, profiles, avatars, ws, dmProgress] = await Promise.all([
    supabase.auth.getUser(),
    listProfiles(),
    listAvatarsForSwitcher(),
    getWorkspaceSettings(),
    getDmProgress(id),
  ]);
  const currentUserId = userData.user?.id ?? "";

  // This campaign's own wording, falling back to the workspace defaults for a
  // campaign nobody has edited yet.
  const wording = (
    field:
      | "linkedin_dm_template"
      | "linkedin_followup_1"
      | "linkedin_followup_2"
      | "linkedin_followup_3",
  ): string => {
    const own = avatar[field];
    if (typeof own === "string" && own.trim()) return own;
    return ws?.[field] ?? "";
  };

  const dmTemplates = {
    first: wording("linkedin_dm_template"),
    followup_1: wording("linkedin_followup_1"),
    followup_2: wording("linkedin_followup_2"),
    followup_3: wording("linkedin_followup_3"),
  };

  const leads = await getChannelLeads({
    avatarId: id,
    channel: "linkedin",
    myLeadsOnly,
    currentUserId,
  });

  return (
    <AppShell
      fullBleed
      breadcrumb={[
        { label: "Avatars", href: "/" },
        { label: avatar.name, href: `/avatars/${id}` },
        { label: "LinkedIn" },
      ]}
      actions={
        <ChannelHeader
          avatars={avatars}
          avatarId={id}
          channelSlug="linkedin"
          myLeadsOnly={myLeadsOnly}
          canFilterByMe={!!currentUserId}
        />
      }
    >
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--accent-soft)]">
            {avatar.name}
          </p>
          <h1 className="font-display text-[30px] leading-tight tracking-[-0.015em] text-[var(--text-primary)]">
            LinkedIn
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <HandoverDialog
            avatarId={id}
            avatarName={avatar.name}
            others={avatars.filter((a) => a.id !== id).map((a) => ({ id: a.id, name: a.name }))}
            profiles={profiles}
            currentUserId={currentUserId}
          />
          <ChannelTabs avatarId={id} />
        </div>
      </div>

      <LinkedInView
        leads={leads}
        profiles={profiles}
        dmTemplates={dmTemplates}
        avatarId={id}
        dmProgress={dmProgress}
      />
    </AppShell>
  );
}
