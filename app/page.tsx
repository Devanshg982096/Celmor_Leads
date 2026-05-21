import { logout } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">Celmor Leads</h1>
      <p className="text-muted-foreground text-sm">Signed in as {user?.email}</p>
      <form action={logout}>
        <Button variant="outline" type="submit">
          Sign out
        </Button>
      </form>
      <p className="text-xs text-muted-foreground mt-4">
        Step 2 (Avatars) coming next.
      </p>
    </div>
  );
}
