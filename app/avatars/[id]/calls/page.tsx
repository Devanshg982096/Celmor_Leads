import { notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
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
  const myLeadsOnly = my !== "0"; // default ON

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
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        <ChannelHeader
          avatars={avatars}
          avatarId={id}
          avatarName={avatar.name}
          channel="Calls"
          channelSlug="calls"
          myLeadsOnly={myLeadsOnly}
          canFilterByMe={!!currentUserId}
        />

        <CallsView leads={leads} profiles={profiles} />
      </main>
    </div>
  );
}
