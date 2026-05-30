import { notFound } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import ChannelHeader from "@/components/channels/ChannelHeader";
import EmailsView from "@/components/channels/EmailsView";
import SmartleadView from "@/components/channels/SmartleadView";
import ChannelTabs from "@/components/avatars/ChannelTabs";
import { createClient } from "@/lib/supabase/server";
import { listProfiles } from "@/lib/avatars/leads-actions";
import {
  getChannelLeads,
  listAvatarsForSwitcher,
} from "@/lib/avatars/channel-queries";
import { listCampaignsAction } from "@/lib/smartlead/actions";
import type { Avatar } from "@/lib/types";

export const dynamic = "force-dynamic";

type SubTab = "leads" | "smartlead";

export default async function EmailsChannelPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ my?: string; tab?: string }>;
}) {
  const { id } = await params;
  const { my, tab } = await searchParams;
  const myLeadsOnly = my !== "0";
  const activeTab: SubTab = tab === "smartlead" ? "smartlead" : "leads";

  const supabase = await createClient();
  const { data: avatarRow } = await supabase
    .from("avatars")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!avatarRow) notFound();
  const avatar = avatarRow as Avatar;

  const [{ data: userData }, profiles, avatars] = await Promise.all([
    supabase.auth.getUser(),
    listProfiles(),
    listAvatarsForSwitcher(),
  ]);
  const currentUserId = userData.user?.id ?? "";

  // Only fetch what the active sub-tab needs, to keep the page fast.
  const leadsPromise =
    activeTab === "leads"
      ? getChannelLeads({
          avatarId: id,
          channel: "emails",
          myLeadsOnly,
          currentUserId,
        })
      : Promise.resolve([]);
  const smartleadPromise =
    activeTab === "smartlead" ? listCampaignsAction() : Promise.resolve(null);

  const [leads, smartlead] = await Promise.all([leadsPromise, smartleadPromise]);

  return (
    <AppShell
      fullBleed
      breadcrumb={[
        { label: "Avatars", href: "/" },
        { label: avatar.name, href: `/avatars/${id}` },
        { label: "Emails" },
      ]}
      actions={
        <ChannelHeader
          avatars={avatars}
          avatarId={id}
          channelSlug="emails"
          myLeadsOnly={myLeadsOnly}
          canFilterByMe={!!currentUserId}
        />
      }
    >
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-[var(--accent-soft)]">
            {avatar.name}
          </p>
          <h1 className="font-display text-[30px] leading-tight tracking-[-0.015em] text-[var(--text-primary)]">
            Emails
          </h1>
        </div>
        <ChannelTabs avatarId={id} />
      </div>

      <SubTabs avatarId={id} active={activeTab} myLeadsOnly={myLeadsOnly} />

      {activeTab === "leads" ? (
        <EmailsView leads={leads} profiles={profiles} />
      ) : (
        <SmartleadView
          initialCampaigns={
            smartlead && "ok" in smartlead && smartlead.ok
              ? smartlead.campaigns
              : null
          }
          initialError={
            smartlead && "ok" in smartlead && !smartlead.ok ? smartlead.error : null
          }
        />
      )}
    </AppShell>
  );
}

function SubTabs({
  avatarId,
  active,
  myLeadsOnly,
}: {
  avatarId: string;
  active: SubTab;
  myLeadsOnly: boolean;
}) {
  // Preserve the `my` filter when switching tabs.
  const myParam = myLeadsOnly ? "" : "&my=0";
  const tabs: { label: string; value: SubTab; href: string }[] = [
    { label: "Leads", value: "leads", href: `/avatars/${avatarId}/emails?tab=leads${myParam}` },
    { label: "Smartlead", value: "smartlead", href: `/avatars/${avatarId}/emails?tab=smartlead${myParam}` },
  ];

  return (
    <div className="mb-4 inline-flex rounded-md border border-[var(--border-subtle)] bg-[var(--bg-overlay)] p-0.5">
      {tabs.map((t) => {
        const selected = t.value === active;
        return (
          <Link
            key={t.value}
            href={t.href}
            className={
              "rounded-[5px] px-3 py-1.5 text-[12.5px] transition-colors " +
              (selected
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]")
            }
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
