import Link from "next/link";
import { notFound } from "next/navigation";
import AppHeader from "@/components/AppHeader";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AvatarDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: avatar } = await supabase
    .from("avatars")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!avatar) notFound();

  const { count: leadCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("avatar_id", id);

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <div className="mb-6">
          <Link href="/" className="text-sm text-muted-foreground hover:underline">
            ← All Avatars
          </Link>
        </div>

        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{avatar.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {(leadCount ?? 0).toLocaleString()} leads · {avatar.visible_columns.length} visible columns
            </p>
          </div>
          <Link href="/" className={buttonVariants({ variant: "outline" })}>
            Back
          </Link>
        </div>

        <div className="rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground">
            Smart table coming in Step 3.
          </p>
        </div>
      </main>
    </div>
  );
}
