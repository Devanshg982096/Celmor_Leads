"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface HandoverResult {
  copied: number;
  alreadyThere: number;
}

/**
 * Hand one campaign's list to the other sender.
 *
 * Copies rather than moves. The person who sent the original connection
 * requests keeps their rows, their stages and any conversation already in
 * flight, because only they are connected to the people who accepted. The
 * person taking over gets their own rows starting at "not started", so they
 * send their own connection requests from their own account.
 *
 * The expensive parts (scraped profile, posts, written openings) come across
 * with the copy, so a handover costs nothing in Apify or Anthropic credits.
 * Anyone already in the target campaign is skipped, which makes this safe to
 * run twice.
 */
export async function handOverCampaign(
  fromAvatarId: string,
  toAvatarId: string,
  ownerId: string | null,
): Promise<{ ok: true; result: HandoverResult } | { ok: false; error: string }> {
  if (!fromAvatarId || !toAvatarId) return { ok: false, error: "Pick a campaign to take over." };
  if (fromAvatarId === toAvatarId) {
    return { ok: false, error: "Pick a different campaign to take over from." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { data, error } = await supabase.rpc("hand_over_leads", {
    p_from: fromAvatarId,
    p_to: toAvatarId,
    p_owner: ownerId,
    p_actor: user.id,
  });
  if (error) return { ok: false, error: error.message };

  const row = (Array.isArray(data) ? data[0] : data) as
    | { copied: number; already_there: number }
    | null
    | undefined;

  revalidatePath(`/avatars/${toAvatarId}/linkedin`);
  revalidatePath(`/avatars/${toAvatarId}`);
  revalidatePath("/");

  return {
    ok: true,
    result: { copied: row?.copied ?? 0, alreadyThere: row?.already_there ?? 0 },
  };
}

export interface CounterpartInfo {
  avatarName: string;
  stage: string;
  ownerName: string | null;
}

/**
 * The same person in another campaign, if there is one.
 *
 * Shown on a lead so neither sender messages someone the other is already
 * mid-conversation with. Matched on the LinkedIn URL, which is the only
 * reliable way to tell two rows are the same human.
 */
export async function findCounterparts(leadId: string): Promise<CounterpartInfo[]> {
  const supabase = await createClient();

  const { data: lead } = await supabase
    .from("leads")
    .select("id, avatar_id, linkedin_url")
    .eq("id", leadId)
    .maybeSingle();
  if (!lead?.linkedin_url) return [];

  const slug = slugOf(lead.linkedin_url);
  if (!slug) return [];

  const { data } = await supabase
    .from("leads")
    .select("id, avatar_id, linkedin_url, linkedin_stage, avatars(name), profiles(display_name)")
    .neq("avatar_id", lead.avatar_id)
    .ilike("linkedin_url", `%/in/${slug}%`)
    .limit(10);

  return (data ?? [])
    .filter((r: Record<string, unknown>) => slugOf(r.linkedin_url as string) === slug)
    .map((r: Record<string, unknown>) => ({
      avatarName: (r.avatars as { name?: string } | null)?.name ?? "another campaign",
      stage: (r.linkedin_stage as string) ?? "none",
      ownerName: (r.profiles as { display_name?: string } | null)?.display_name ?? null,
    }));
}

/** The vanity part of a LinkedIn profile URL, lowercased. */
function slugOf(url: string | null): string | null {
  if (!url) return null;
  const cleaned = url.split("?")[0].split("#")[0].toLowerCase().replace(/\/+$/, "");
  const match = cleaned.match(/\/in\/([^/]+)$/);
  return match ? match[1] : null;
}
