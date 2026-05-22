import { notFound } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import ChannelHeader from "@/components/channels/ChannelHeader";
import EmailsView from "@/components/channels/EmailsView";
import ChannelTabs from "@/components/avatars/ChannelTabs";
import { createClient } from "@/lib/supabase/server";
import { listProfiles } from "@/lib/avatars/leads-actions";
import {
  getChannelLeads,
  listAvatarsForSwitcher,
} from "@/lib/avatars/channel-queries";
import type { Avatar } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EmailsChannelPage({
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

  const [{ data: userData }, profiles, avatars] = await Promise.all([
    supabase.auth.getUser(),
    listProfiles(),
    listAvatarsForSwitcher(),
  ]);
  const currentUserId = userData.user?.id ?? "";

  const leads = await getChannelLeads({
    avatarId: id,
    channel: "emails",
    myLeadsOnly,
    currentUserId,
  });

  return (
    <AppShell
      fullBleed
      breadcrumb={[
        { label: "Avatars", href: "/" },
        { label: avatar.name, href: `/avatars/${id}` },
        { label: "Emails" },
      ]}
      actions={
        <ChannelHeader
          avatars={avatars}
          avatarId={id}
          channelSlug="emails"
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
            Emails
          </h1>
        </div>
        <ChannelTabs avatarId={id} />
      </div>

      <EmailsView leads={leads} profiles={profiles} />
    </AppShell>
  );
}
