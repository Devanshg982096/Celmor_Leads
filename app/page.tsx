import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import AvatarCard from "@/components/avatars/AvatarCard";
import { buttonVariants } from "@/components/ui/button";
import { listAvatarsWithStats } from "@/lib/avatars/actions";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const avatars = await listAvatarsWithStats();

  return (
    <AppShell
      breadcrumb={[{ label: "Avatars" }]}
      actions={
        <Link href="/avatars/new" className={buttonVariants({ size: "sm" })}>
          New avatar
        </Link>
      }
    >
      <div className="mb-6">
        <h1 className="text-[28px] font-semibold tracking-tight text-[var(--text-primary)]">
          Avatars
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Each Avatar is a target persona imported from Apollo.
        </p>
      </div>

      {avatars.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border-default)] py-16 text-center">
          <p className="text-[var(--text-secondary)] mb-4">No Avatars yet.</p>
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
    </AppShell>
  );
}
