import { createClient } from "@/lib/supabase/server";
import { listAvatarsForSwitcher } from "@/lib/avatars/channel-queries";
import Sidebar from "@/components/layout/Sidebar";
import TopBar, { type BreadcrumbItem } from "@/components/layout/TopBar";

interface Props {
  breadcrumb?: BreadcrumbItem[];
  actions?: React.ReactNode;
  /** If true, content area is full-bleed (no max-width). Default: false. */
  fullBleed?: boolean;
  children: React.ReactNode;
}

export default async function AppShell({
  breadcrumb,
  actions,
  fullBleed = false,
  children,
}: Props) {
  const supabase = await createClient();
  const [{ data: userData }, avatars] = await Promise.all([
    supabase.auth.getUser(),
    listAvatarsForSwitcher(),
  ]);
  const user = userData.user;

  let displayName = "—";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();
    displayName =
      (profile as { display_name?: string } | null)?.display_name ??
      user.email ??
      "—";
  }

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar
        avatars={avatars}
        user={{ id: user?.id ?? "anon", displayName }}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {(breadcrumb || actions) && (
          <TopBar breadcrumb={breadcrumb} actions={actions} />
        )}
        <main
          className={
            fullBleed
              ? "flex-1 px-6 py-6"
              : "flex-1 mx-auto w-full max-w-[1400px] px-6 py-6"
          }
        >
          {children}
        </main>
      </div>
    </div>
  );
}
