import { notFound } from "next/navigation";
import ChannelComingSoon from "@/components/avatars/ChannelComingSoon";
import { createClient } from "@/lib/supabase/server";
import type { Avatar } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CallsChannelPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("avatars")
    .select("name")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const avatar = data as Pick<Avatar, "name">;

  return (
    <ChannelComingSoon
      avatarId={id}
      avatarName={avatar.name}
      channel="Calls"
      stepNumber={3}
    />
  );
}
