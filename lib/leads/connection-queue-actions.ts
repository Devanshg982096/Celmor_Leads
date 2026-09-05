"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { canonicalLinkedInUrl } from "./profile-import";
import { advanceConnectionQueue } from "./connection-queue-worker";
import type { ConnectionQueueItem } from "./connection-queue";

async function context(avatarId: string) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error("Please sign in again.");
  const { data, error } = await db.from("avatars").select("id").eq("id", avatarId).single();
  if (error || !data) throw new Error("Avatar not found.");
  return { db, user };
}
export async function readConnectionQueue(avatarId: string) {
  try {
    const { db } = await context(avatarId);
    const { data, error } = await db.from("profile_import_queue").select("id,linkedin_url,status,created_at,error,lead_id")
      .eq("avatar_id", avatarId).neq("status", "cancelled").order("created_at").limit(1000);
    if (error) throw new Error("Could not load the URL list. Please try again.");
    return { items: data as ConnectionQueueItem[] };
  } catch (e) { return { error: e instanceof Error ? e.message : "Could not load list." }; }
}
export async function addConnectionUrls(avatarId: string, text: string) {
  try {
    const entries = text.trim().split(/\s+/).filter(Boolean);
    if (!entries.length || entries.length > 100) throw new Error("Paste between 1 and 100 LinkedIn profile URLs.");
    const urls = [...new Set(entries.map(canonicalLinkedInUrl))];
    const { db, user } = await context(avatarId);
    const { error } = await db.from("profile_import_queue").upsert(urls.map(linkedin_url => ({ avatar_id: avatarId, linkedin_url, added_by: user.id })), { onConflict: "avatar_id,linkedin_url", ignoreDuplicates: true });
    if (error) throw new Error("Could not save these URLs. They are still in the input; try again.");
    // Re-adding a removed entry is explicit intent to collect that URL again.
    const { error: restoreError } = await db.from("profile_import_queue").update({ status: "draft", connection_sent_at: new Date().toISOString(), added_by: user.id })
      .eq("avatar_id", avatarId).eq("status", "cancelled").in("linkedin_url", urls);
    if (restoreError) throw new Error("Could not restore a removed URL. Please try again.");
    return { ok: true };
  } catch (e) { return { error: e instanceof Error ? e.message : "Could not save URLs." }; }
}
export async function controlConnectionQueue(avatarId: string, action: "start" | "pause" | "retry" | "remove", id?: string) {
  try {
    const { db } = await context(avatarId);
    if (!["start", "pause", "retry", "remove"].includes(action)) throw new Error("Invalid action.");
    if ((action === "retry" || action === "remove") && !id) throw new Error("Select an entry.");
    const query = db.from("profile_import_queue");
    const result = action === "start"
      ? await query.update({ status: "queued", error: null }).eq("avatar_id", avatarId).eq("status", "draft")
      : action === "pause"
        ? await query.update({ status: "draft" }).eq("avatar_id", avatarId).eq("status", "queued")
        : action === "retry"
          ? await query.update({ status: "queued", error: null, lease_token: null, lease_until: null }).eq("avatar_id", avatarId).eq("id", id!).eq("status", "failed")
          : await query.update({ status: "cancelled" }).eq("avatar_id", avatarId).eq("id", id!).in("status", ["draft", "failed"]);
    if (result.error) throw new Error("Could not update the queue. Please try again.");
    return { ok: true };
  } catch (e) { return { error: e instanceof Error ? e.message : "Could not update queue." }; }
}
export async function tickConnectionQueue(avatarId: string) {
  try {
    const { db } = await context(avatarId);
    await advanceConnectionQueue(db, avatarId);
    revalidatePath(`/avatars/${avatarId}/master`);
    return { ok: true };
  } catch (e) { return { error: e instanceof Error ? e.message : "Processing paused. Please try again." }; }
}
