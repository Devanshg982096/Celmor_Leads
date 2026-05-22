import Link from "next/link";
import { Download, Plus } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import AvatarCard from "@/components/avatars/AvatarCard";
import { buttonVariants } from "@/components/ui/button";
import { listAvatarsWithStats } from "@/lib/avatars/actions";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const avatars = await listAvatarsWithStats();

  return (
    <AppShell breadcrumb={[{ label: "Avatars" }]} fullBleed>
      {/* Page header */}
      <header className="mb-6 flex items-end justify-between gap-6">
        <div>
          <h1 className="font-display text-[30px] leading-tight tracking-[-0.015em] text-[var(--text-primary)]">
            Avatars
          </h1>
          <p className="mt-1 text-[13.5px] text-[var(--text-secondary)]">
            Each Avatar is a target persona imported from Apollo
            {avatars.length > 0 && (
              <>
                {" · "}
                <span className="text-[var(--text-tertiary)]">
                  {avatars.length} active
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/export/avatars"
            download
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            <Download className="size-4" />
            Export
          </a>
          <Link
            href="/avatars/new"
            className={buttonVariants({ size: "sm" })}
          >
            <Plus className="size-4" />
            New avatar
          </Link>
        </div>
      </header>

      {avatars.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border-default)] py-16 text-center">
          <p className="text-[var(--text-secondary)] mb-4">No Avatars yet.</p>
          <Link href="/avatars/new" className={buttonVariants()}>
            Import your first CSV
          </Link>
        </div>
      ) : (
        <div
          className="grid gap-[14px]"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          }}
        >
          {avatars.map((a) => (
            <AvatarCard key={a.id} avatar={a} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
