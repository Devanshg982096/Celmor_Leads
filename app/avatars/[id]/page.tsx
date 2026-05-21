import Link from "next/link";
import { notFound } from "next/navigation";
import { Phone, Users, Mail, Table2 } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getChannelStats } from "@/lib/avatars/channel-stats";
import type { Avatar } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AvatarHubPage({
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

  const stats = await getChannelStats(id);

  const cards = [
    {
      href: `/avatars/${id}/calls`,
      icon: Phone,
      title: "Calls",
      summary: `${stats.calls.qualifiedDialable.toLocaleString()} qualified leads · ${stats.calls.reached.toLocaleString()} reached · ${stats.calls.toFollowUp.toLocaleString()} to follow up`,
    },
    {
      href: `/avatars/${id}/linkedin`,
      icon: Users,
      title: "LinkedIn",
      summary: `${stats.linkedin.qualifiedReachable.toLocaleString()} qualified leads · ${stats.linkedin.connected.toLocaleString()} connected · ${stats.linkedin.replied.toLocaleString()} replied`,
    },
    {
      href: `/avatars/${id}/emails`,
      icon: Mail,
      title: "Emails",
      summary: `${stats.emails.qualifiedEmailable.toLocaleString()} qualified leads · ${stats.emails.sent.toLocaleString()} sent · ${stats.emails.replied.toLocaleString()} replied`,
    },
    {
      href: `/avatars/${id}/master`,
      icon: Table2,
      title: "Master Sheet",
      summary: `${stats.total.toLocaleString()} total leads · ${stats.qualified.toLocaleString()} qualified · ${stats.unqualified.toLocaleString()} unqualified`,
      emphasised: true,
    },
  ] as const;

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <div className="mb-4">
          <Link href="/" className="text-sm text-muted-foreground hover:underline">
            ← All Avatars
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">{avatar.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {stats.total.toLocaleString()} leads · pick a channel to work in
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <Link
                key={c.href}
                href={c.href}
                className="group block focus:outline-none"
              >
                <Card
                  className={
                    "h-full transition-shadow group-hover:shadow-md group-focus-visible:shadow-md " +
                    ("emphasised" in c && c.emphasised
                      ? "border-primary/40"
                      : "")
                  }
                >
                  <CardContent className="p-6 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-md bg-primary/10 text-primary p-2">
                        <Icon className="size-5" />
                      </div>
                      <h2 className="text-lg font-semibold leading-none">
                        {c.title}
                      </h2>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {c.summary}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
