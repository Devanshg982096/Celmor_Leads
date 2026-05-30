import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listCampaignLeads } from "@/lib/smartlead/client";
import type { EmailStatus, WorkspaceSettings } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Sync each campaign Narada has pushed leads to. For every Smartlead lead
 * with a matching email in our DB, promote email_status when Smartlead shows
 * a reply or a bounce. We never downgrade: once 'replied' or 'bounced' is
 * set, it stays.
 *
 * Auth: same CRON_SECRET bearer as the enrich tick.
 * Toggle: same workspace_settings.cron_enabled flag — pause one, pause both.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const startedAt = Date.now();
  const summary = {
    campaigns_checked: 0,
    leads_seen: 0,
    promoted_replied: 0,
    promoted_bounced: 0,
    errors: [] as string[],
  };

  const { data: settingsRow } = await supabase
    .from("workspace_settings")
    .select("smartlead_api_key, cron_enabled")
    .eq("id", 1)
    .maybeSingle();
  const settings = settingsRow as Pick<WorkspaceSettings, "smartlead_api_key" | "cron_enabled"> | null;
  if (!settings?.cron_enabled) {
    return NextResponse.json({ ok: true, paused: true, elapsed_ms: Date.now() - startedAt });
  }
  if (!settings.smartlead_api_key) {
    return NextResponse.json({
      ok: false,
      reason: "Smartlead API key not set in Settings",
      elapsed_ms: Date.now() - startedAt,
    });
  }

  // Distinct campaign IDs Narada has pushed leads to.
  const { data: campaignRows } = await supabase
    .from("leads")
    .select("smartlead_campaign_id")
    .not("smartlead_campaign_id", "is", null);
  const campaignIds = Array.from(
    new Set(
      (campaignRows ?? [])
        .map((r) => (r as { smartlead_campaign_id: string | null }).smartlead_campaign_id)
        .filter((v): v is string => !!v),
    ),
  );

  for (const idStr of campaignIds) {
    const campaignId = Number(idStr);
    if (!Number.isFinite(campaignId)) continue;
    summary.campaigns_checked++;

    let smartleadLeads;
    try {
      smartleadLeads = await listCampaignLeads(settings.smartlead_api_key, campaignId);
    } catch (e) {
      summary.errors.push(`campaign ${campaignId}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }

    if (smartleadLeads.length === 0) continue;
    summary.leads_seen += smartleadLeads.length;

    // Pull our leads for this campaign in one shot so we can match by email.
    const { data: ourLeadsRow } = await supabase
      .from("leads")
      .select("id, email, email_status")
      .eq("smartlead_campaign_id", idStr);
    const ourLeads = (ourLeadsRow ?? []) as { id: string; email: string; email_status: EmailStatus }[];
    const ourByEmail = new Map(ourLeads.map((l) => [l.email.toLowerCase(), l]));

    for (const sl of smartleadLeads) {
      const ours = ourByEmail.get(sl.email);
      if (!ours) continue;
      // Decide the desired new status. Bounce beats reply, both beat sent.
      let next: EmailStatus | null = null;
      if ((sl.bounce_count ?? 0) > 0 && ours.email_status !== "bounced") {
        next = "bounced";
      } else if (
        (sl.reply_count ?? 0) > 0 &&
        ours.email_status !== "replied" &&
        ours.email_status !== "bounced"
      ) {
        next = "replied";
      }
      if (!next) continue;

      const now = new Date().toISOString();
      const { error: updateErr } = await supabase
        .from("leads")
        .update({ email_status: next, email_status_updated_at: now })
        .eq("id", ours.id);
      if (updateErr) {
        summary.errors.push(`${ours.id}: ${updateErr.message}`);
        continue;
      }
      if (next === "replied") summary.promoted_replied++;
      if (next === "bounced") summary.promoted_bounced++;
    }
  }

  return NextResponse.json({
    ok: true,
    elapsed_ms: Date.now() - startedAt,
    ...summary,
  });
}
