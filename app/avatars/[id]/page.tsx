import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import HubHero from "@/components/hub/HubHero";
import MasterTile from "@/components/hub/MasterTile";
import LinkedInTile from "@/components/hub/LinkedInTile";
import EmailsTile from "@/components/hub/EmailsTile";
import CallsTile from "@/components/hub/CallsTile";
import AddLeadsDialog from "@/components/hub/AddLeadsDialog";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getHubData } from "@/lib/avatars/hub-data";
import type { Avatar } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AvatarHubPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: avatarRow } = await supabase
    .from("avatars")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!avatarRow) notFound();
  const avatar = avatarRow as Avatar;

  const hub = await getHubData(id);

  return (
    <AppShell
      breadcrumb={[
        { label: "Avatars", href: "/" },
        { label: avatar.name },
      ]}
    >
      <HubHero
        avatarName={avatar.name}
        source={avatar.source}
        createdAt={avatar.created_at}
        leadCount={hub.total}
        totals={{
          contacted: hub.contacted,
          replied: hub.replied,
          won: hub.won,
        }}
      />

      {/* Section meta row */}
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--text-tertiary)]">
          Four channels · pick your surface
        </p>
        <div className="flex items-center gap-1">
          <AddLeadsDialog avatarId={id} />
          <a
            href={`/api/export/avatars/${id}/leads`}
            download
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            <Download className="size-4" />
            Export
          </a>
        </div>
      </div>

      {/* Channels grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <MasterTile avatarId={id} total={hub.total} data={hub.master} />
        <LinkedInTile avatarId={id} data={hub.linkedin} />
        <EmailsTile avatarId={id} data={hub.emails} />
        <CallsTile avatarId={id} data={hub.calls} />
      </div>
    </AppShell>
  );
}
