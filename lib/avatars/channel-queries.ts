import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Avatar, Lead } from "@/lib/types";

export type ChannelKind = "calls" | "linkedin" | "emails";

/**
 * Channel-specific server fetch. Uses indexed columns: (avatar_id, qualified)
 * and (avatar_id, owner_id, qualified).
 */
export async function getChannelLeads(opts: {
  avatarId: string;
  channel: ChannelKind;
  myLeadsOnly: boolean;
  currentUserId: string;
}): Promise<Lead[]> {
  const supabase = await createClient();

  let q = supabase
    .from("leads")
    .select("*")
    .eq("avatar_id", opts.avatarId)
    .eq("qualified", "qualified");

  if (opts.channel === "calls") q = q.not("phone", "is", null);
  if (opts.channel === "linkedin") q = q.not("linkedin_url", "is", null);
  if (opts.channel === "emails") q = q.not("email", "is", null);

  if (opts.myLeadsOnly && opts.currentUserId) {
    q = q.eq("owner_id", opts.currentUserId);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as Lead[];
}

/**
 * List of all Avatars (just id + name) for the avatar switcher.
 */
export async function listAvatarsForSwitcher(): Promise<
  Pick<Avatar, "id" | "name">[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("avatars")
    .select("id, name")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Pick<Avatar, "id" | "name">[];
}
