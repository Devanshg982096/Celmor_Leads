import AppShell from "@/components/layout/AppShell";
import NewAvatarFlow from "@/components/avatars/NewAvatarFlow";

export const metadata = { title: "New Avatar — Narada" };

export default function NewAvatarPage() {
  return (
    <AppShell
      breadcrumb={[
        { label: "Avatars", href: "/" },
        { label: "New" },
      ]}
    >
      <div className="max-w-3xl">
        <div className="mb-6">
          <h1 className="text-[28px] font-semibold tracking-tight text-[var(--text-primary)]">
            Create new Avatar
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Each Avatar is one Apollo CSV import representing a target persona.
          </p>
        </div>
        <NewAvatarFlow />
      </div>
    </AppShell>
  );
}
