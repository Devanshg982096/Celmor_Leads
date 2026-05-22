import { notFound } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import LeadsTable from "@/components/avatars/LeadsTable";
import ChannelTabs from "@/components/avatars/ChannelTabs";
import { createClient } from "@/lib/supabase/server";
import { listLeadsForAvatar, listProfiles } from "@/lib/avatars/leads-actions";
import type { Avatar } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MasterSheetPage({
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

  const [leads, profiles, { data: userData }] = await Promise.all([
    listLeadsForAvatar(id),
    listProfiles(),
    supabase.auth.getUser(),
  ]);
  const currentUserId = userData.user?.id ?? "";

  return (
    <AppShell
      fullBleed
      breadcrumb={[
        { label: "Avatars", href: "/" },
        { label: avatar.name, href: `/avatars/${id}` },
        { label: "Master Sheet" },
      ]}
    >
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--accent-soft)]">
            {avatar.name}
          </p>
          <h1 className="font-display text-[30px] leading-tight tracking-[-0.015em] text-[var(--text-primary)]">
            Master sheet
          </h1>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
            {leads.length.toLocaleString("en-GB")} leads ·{" "}
            {avatar.visible_columns.length} visible columns
          </p>
        </div>
        <ChannelTabs avatarId={id} />
      </div>

      <LeadsTable
        leads={leads}
        visibleColumns={avatar.visible_columns}
        profiles={profiles}
        currentUserId={currentUserId}
      />
    </AppShell>
  );
}
