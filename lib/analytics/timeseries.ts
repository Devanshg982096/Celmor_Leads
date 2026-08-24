import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Returns counts of activity_log rows per ISO day (UTC), for a single avatar,
 * optionally filtered by an action substring (e.g. "Email status").
 *
 * - Days with no activity get 0 (no gaps).
 * - The latest entry is "today" — index `days - 1`.
 * - Used by the Avatar card sparkline + the Emails 14-day histogram + the
 *   Calls best-window heat map (once we have enough data to derive one).
 */
export async function activityCountsByDay(opts: {
  avatarId: string;
  days: number;
  /** Optional case-insensitive substring filter on action text. */
  actionLike?: string;
}): Promise<number[]> {
  const supabase = await createClient();
  const sinceMs = Date.now() - opts.days * 24 * 60 * 60 * 1000;
  const sinceIso = new Date(sinceMs).toISOString();

  // Joined rather than filtered by a list of ids. Fetching every lead id and
  // sending them back in 500-item IN clauses meant several sequential requests
  // with roughly 18KB of ids in the URL each, which is what made the hub time
  // out intermittently on larger campaigns.
  const base = supabase
    .from("activity_log")
    .select("created_at, action, leads!inner(avatar_id)")
    .eq("leads.avatar_id", opts.avatarId)
    .gte("created_at", sinceIso);

  const { data } = opts.actionLike
    ? await base.ilike("action", `%${opts.actionLike}%`)
    : await base;
  const rows = (data ?? []) as { created_at: string; action: string }[];

  // Bucket by UTC day, indexed 0..days-1 where days-1 is today.
  const buckets = new Array(opts.days).fill(0) as number[];
  const dayMs = 24 * 60 * 60 * 1000;
  const todayUtcStart = Math.floor(Date.now() / dayMs);
  for (const r of rows) {
    const rowDay = Math.floor(new Date(r.created_at).getTime() / dayMs);
    const idx = opts.days - 1 - (todayUtcStart - rowDay);
    if (idx >= 0 && idx < opts.days) buckets[idx]++;
  }
  return buckets;
}

/**
 * Returns per-day counts of {sent, replied, bounced} email events for the
 * Emails tile / page histogram. We infer "sent" from any non-`none`
 * email-status change action text.
 */
export async function emailsByDay(opts: {
  avatarId: string;
  days: number;
}): Promise<{ sent: number[]; replied: number[]; bounced: number[] }> {
  const supabase = await createClient();
  const sinceMs = Date.now() - opts.days * 24 * 60 * 60 * 1000;
  const sinceIso = new Date(sinceMs).toISOString();

  const empty = () => new Array(opts.days).fill(0) as number[];

  // One joined query, for the same reason as activityCountsByDay above.
  const { data } = await supabase
    .from("activity_log")
    .select("created_at, action, leads!inner(avatar_id)")
    .eq("leads.avatar_id", opts.avatarId)
    .gte("created_at", sinceIso)
    .ilike("action", "Email status%");
  const rows = (data ?? []) as { created_at: string; action: string }[];

  const sent = empty();
  const replied = empty();
  const bounced = empty();
  const dayMs = 24 * 60 * 60 * 1000;
  const todayUtcStart = Math.floor(Date.now() / dayMs);

  for (const r of rows) {
    const rowDay = Math.floor(new Date(r.created_at).getTime() / dayMs);
    const idx = opts.days - 1 - (todayUtcStart - rowDay);
    if (idx < 0 || idx >= opts.days) continue;
    const action = r.action.toLowerCase();
    // "Email status → smartlead_sent" | "Email status → replied" | "Email status → bounced"
    if (action.includes("replied")) replied[idx]++;
    else if (action.includes("bounced")) bounced[idx]++;
    else if (action.includes("smartlead_sent")) sent[idx]++;
  }

  return { sent, replied, bounced };
}
