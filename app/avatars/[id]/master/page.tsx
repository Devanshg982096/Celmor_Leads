import { notFound } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import LeadsTable from "@/components/avatars/LeadsTable";
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
      <div className="mb-6">
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--text-primary)]">
          {avatar.name}
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          {leads.length.toLocaleString()} leads · {avatar.visible_columns.length} visible columns
        </p>
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
