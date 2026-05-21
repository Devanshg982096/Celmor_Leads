import Link from "next/link";
import { notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import LeadsTable from "@/components/avatars/LeadsTable";
import { buttonVariants } from "@/components/ui/button";
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
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:underline">
            Avatars
          </Link>
          <span>/</span>
          <Link href={`/avatars/${id}`} className="hover:underline">
            {avatar.name}
          </Link>
          <span>/</span>
          <span className="text-foreground">Master Sheet</span>
        </div>

        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{avatar.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {leads.length.toLocaleString()} leads · {avatar.visible_columns.length} visible columns
            </p>
          </div>
          <Link
            href={`/avatars/${id}`}
            className={buttonVariants({ variant: "outline" })}
          >
            Back to hub
          </Link>
        </div>

        <LeadsTable
          leads={leads}
          visibleColumns={avatar.visible_columns}
          profiles={profiles}
          currentUserId={currentUserId}
        />
      </main>
    </div>
  );
}
