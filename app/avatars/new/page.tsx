import AppHeader from "@/components/AppHeader";
import NewAvatarFlow from "@/components/avatars/NewAvatarFlow";

export const metadata = { title: "New Avatar — Celmor Leads" };

export default function NewAvatarPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Create new Avatar</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Each Avatar is one Apollo CSV import representing a target persona.
          </p>
        </div>
        <NewAvatarFlow />
      </main>
    </div>
  );
}
