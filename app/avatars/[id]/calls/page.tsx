import { notFound } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import ChannelHeader from "@/components/channels/ChannelHeader";
import CallsView from "@/components/channels/CallsView";
import { createClient } from "@/lib/supabase/server";
import { listProfiles } from "@/lib/avatars/leads-actions";
import {
  getChannelLeads,
  listAvatarsForSwitcher,
} from "@/lib/avatars/channel-queries";
import type { Avatar } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CallsChannelPage({
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
    channel: "calls",
    myLeadsOnly,
    currentUserId,
  });

  return (
    <AppShell
      fullBleed
      breadcrumb={[
        { label: "Avatars", href: "/" },
        { label: avatar.name, href: `/avatars/${id}` },
        { label: "Calls" },
      ]}
      actions={
        <ChannelHeader
          avatars={avatars}
          avatarId={id}
          channelSlug="calls"
          myLeadsOnly={myLeadsOnly}
          canFilterByMe={!!currentUserId}
        />
      }
    >
      <div className="mb-6">
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--text-primary)]">
          Calls
        </h1>
      </div>

      <CallsView leads={leads} profiles={profiles} />
    </AppShell>
  );
}
