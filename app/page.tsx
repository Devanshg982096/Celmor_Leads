import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import AvatarCard from "@/components/avatars/AvatarCard";
import { buttonVariants } from "@/components/ui/button";
import { listAvatarsWithStats } from "@/lib/avatars/actions";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const avatars = await listAvatarsWithStats();

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Avatars</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Each Avatar is a target persona imported from Apollo.
            </p>
          </div>
          <Link href="/avatars/new" className={buttonVariants()}>
            Create new Avatar
          </Link>
        </div>

        {avatars.length === 0 ? (
          <div className="rounded-lg border border-dashed py-16 text-center">
            <p className="text-muted-foreground mb-4">No Avatars yet.</p>
            <Link href="/avatars/new" className={buttonVariants()}>
              Import your first CSV
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {avatars.map((a) => (
              <AvatarCard key={a.id} avatar={a} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
