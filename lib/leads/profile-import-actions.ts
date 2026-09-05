"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { startRun, getRun, getDatasetItems, isTerminal } from "@/lib/enrichment/apify";
import { LINKEDIN_ACTOR_ID, buildLinkedInInput } from "@/lib/enrichment/linkedin";
import { canonicalLinkedInUrl, mapProfile, validateDraft, type ProfileDraft } from "./profile-import";
import { signProfileTicket, verifyProfileTicket } from "./profile-ticket";

async function context(avatarId: string) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error("Please sign in again.");
  const { data: avatar, error } = await db.from("avatars").select("id").eq("id", avatarId).single();
  if (error || !avatar) throw new Error("Avatar not found.");
  const { data: settings } = await db.from("workspace_settings").select("apify_token").eq("id", 1).single();
  if (!settings?.apify_token) throw new Error("Add your Apify token in Settings before fetching a profile.");
  return { db, user, token: settings.apify_token as string };
}

async function duplicates(db: Awaited<ReturnType<typeof createClient>>, avatarId: string, url: string, email = "") {
  // Match common URL spellings and tracking suffixes without interpolating a PostgREST filter.
  const slug = url.split("/in/")[1].replace(/[%_]/g, "\\$&");
  const { data: byUrl, error } = await db.from("leads").select("id,avatar_id,name,linkedin_url,avatars(name)")
    .ilike("linkedin_url", `%linkedin.com/in/${slug}%`);
  if (error) throw new Error("Could not check existing leads. Please try again.");
  const exact = (byUrl ?? []).filter(row => {
    try { return canonicalLinkedInUrl(row.linkedin_url ?? "") === url; } catch { return false; }
  });
  if (email) {
    const { data, error: emailError } = await db.from("leads").select("id,avatar_id,name,linkedin_url,avatars(name)").ilike("email", email.replace(/[%_]/g, "\\$&"));
    if (emailError) throw new Error("Could not check existing leads. Please try again.");
    for (const row of data ?? []) if (!exact.some(item => item.id === row.id)) exact.push(row);
  }
  return exact.map(row => ({ id: row.id, name: row.name, sameAvatar: row.avatar_id === avatarId }));
}

export async function startProfileImport(avatarId: string, inputUrl: string) {
  try {
    const url = canonicalLinkedInUrl(inputUrl);
    const { db, user, token } = await context(avatarId);
    const matches = await duplicates(db, avatarId, url);
    if (matches.some(match => match.sameAvatar)) return { error: "This LinkedIn profile is already in this Avatar." };
    let run;
    try { run = await startRun(LINKEDIN_ACTOR_ID, buildLinkedInInput(url), token); }
    catch { return { error: "Apify could not start the lookup. Check your token, credits and actor access in Apify, then try again." }; }
    return { ticket: signProfileTicket({ runId: run.id, userId: user.id, avatarId, url, expires: Date.now() + 24 * 60 * 60 * 1000, leadId: randomUUID() }, token), url };
  } catch (e) { return { error: e instanceof Error ? e.message : "Could not start lookup." }; }
}

export async function pollProfileImport(avatarId: string, ticket: string) {
  try {
    const { db, user, token } = await context(avatarId);
    const data = verifyProfileTicket(ticket, token, user.id, avatarId);
    let run;
    try { run = await getRun(data.runId, token); }
    catch { return { error: "Unable to check Apify right now. Use Check again to resume this lookup." }; }
    if (!isTerminal(run.status)) return { pending: true as const };
    if (run.status !== "SUCCEEDED") return { error: `Apify lookup ${run.status.toLowerCase().replaceAll("_", " ")}. Try another lookup or check your Apify account.` };
    let items;
    try { items = await getDatasetItems<Record<string, unknown>>(run.defaultDatasetId, token); }
    catch { return { error: "Unable to read the result. Use Check again to retry without starting a new lookup." }; }
    const profile = items.find(item => {
      const returnedUrl = item.linkedinUrl ?? item.linkedinPublicUrl ?? item.inputUrl;
      try { return typeof returnedUrl === "string" && canonicalLinkedInUrl(returnedUrl) === data.url; } catch { return false; }
    });
    if (!profile) return { error: "Apify returned no matching profile. Check the URL and try another lookup." };
    const draft = mapProfile(profile);
    return { draft, duplicates: await duplicates(db, avatarId, data.url, draft.email), cost: run.usageTotalUsd };
  } catch (e) { return { error: e instanceof Error ? e.message : "Could not read profile." }; }
}

export async function saveProfileImport(avatarId: string, ticket: string, input: ProfileDraft) {
  try {
    const draft = validateDraft(input);
    const { db, user, token } = await context(avatarId);
    const data = verifyProfileTicket(ticket, token, user.id, avatarId);
    const { data: saved } = await db.from("leads").select("id").eq("id", data.leadId).eq("avatar_id", avatarId).maybeSingle();
    if (saved) return { id: saved.id as string };
    const matches = await duplicates(db, avatarId, data.url, draft.email);
    if (matches.some(match => match.sameAvatar)) return { error: "This lead is already in this Avatar. No duplicate was added." };
    const { error } = await db.from("leads").insert({
      id: data.leadId, avatar_id: avatarId, name: draft.name, email: draft.email,
      company: draft.company || null, title: draft.title || null, phone: draft.phone || null,
      linkedin_url: data.url,
      raw_data: { ...draft, linkedin_url: data.url, source: "Apify LinkedIn", source_url: data.url,
        apify_run_id: data.runId, imported_at: new Date().toISOString(), email_verification: draft.email ? "unverified" : "not_found" },
    });
    if (error) {
      if (error.code !== "23505") return { error: "Could not save this lead. Your details are still here; please try again." };
      const { data: existing } = await db.from("leads").select("id").eq("id", data.leadId).eq("avatar_id", avatarId).maybeSingle();
      if (!existing) return { error: "A matching lead already exists. No duplicate was added." };
    }
    revalidatePath("/", "layout");
    return { id: data.leadId };
  } catch (e) { return { error: e instanceof Error ? e.message : "Could not save lead." }; }
}
