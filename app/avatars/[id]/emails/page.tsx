import { notFound } from "next/navigation";
import Link from "next/link";
import AppShell from "@/components/layout/AppShell";
import ChannelHeader from "@/components/channels/ChannelHeader";
import EmailsView from "@/components/channels/EmailsView";
import SmartleadView from "@/components/channels/SmartleadView";
import PlannerView from "@/components/channels/PlannerView";
import ChannelTabs from "@/components/avatars/ChannelTabs";
import { createClient } from "@/lib/supabase/server";
import { listProfiles } from "@/lib/avatars/leads-actions";
import {
  getChannelLeads,
  listAvatarsForSwitcher,
} from "@/lib/avatars/channel-queries";
import { listCampaignsAction } from "@/lib/smartlead/actions";
import { listPlansAction } from "@/lib/planner/actions";
import { getWorkspaceSettings } from "@/lib/settings/workspace-actions";
import type { Avatar } from "@/lib/types";

export const dynamic = "force-dynamic";

type SubTab = "leads" | "smartlead" | "planner";

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
  const activeTab: SubTab =
    tab === "smartlead" ? "smartlead" : tab === "planner" ? "planner" : "leads";

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
  // Plans for the Plan column in the Leads sub-tab. Cheap (a few rows max).
  const plansForLeadsPromise =
    activeTab === "leads"
      ? supabase
          .from("campaign_plans")
          .select("id, name")
          .eq("avatar_id", id)
          .then(({ data }) => (data ?? []) as { id: string; name: string }[])
      : Promise.resolve([] as { id: string; name: string }[]);
  const smartleadPromise =
    activeTab === "smartlead" ? listCampaignsAction() : Promise.resolve(null);
  const plannerPromise =
    activeTab === "planner"
      ? Promise.all([
          listPlansAction(id),
          // Pool count: qualified leads on this avatar not yet in a plan
          supabase
            .from("leads")
            .select("id", { count: "exact", head: true })
            .eq("avatar_id", id)
            .eq("qualified", "qualified")
            .is("campaign_plan_id", null),
          getWorkspaceSettings(),
        ])
      : Promise.resolve(null);

  const [leads, smartlead, planner, plansForLeads] = await Promise.all([
    leadsPromise,
    smartleadPromise,
    plannerPromise,
    plansForLeadsPromise,
  ]);

  const planNameById: Record<string, string> = {};
  for (const p of plansForLeads) planNameById[p.id] = p.name;

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
        <EmailsView leads={leads} profiles={profiles} planNameById={planNameById} />
      ) : activeTab === "smartlead" ? (
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
      ) : (
        <PlannerView
          avatarId={id}
          initialPlans={planner ? planner[0] : []}
          unassignedPoolCount={planner ? (planner[1].count ?? 0) : 0}
          smartleadKeyPresent={!!planner?.[2]?.smartlead_api_key}
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
    { label: "Planner", value: "planner", href: `/avatars/${avatarId}/emails?tab=planner${myParam}` },
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
