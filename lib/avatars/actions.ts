"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Avatar, AvatarWithStats, Profile } from "@/lib/types";

/**
 * Fetch all avatars with aggregated stats (owner split, contacted/replied/won).
 */
export async function listAvatarsWithStats(): Promise<AvatarWithStats[]> {
  const supabase = await createClient();

  const [{ data: avatars }, { data: profiles }, { data: leads }] = await Promise.all([
    supabase.from("avatars").select("*").order("created_at", { ascending: false }),
    supabase.from("profiles").select("*"),
    supabase
      .from("leads")
      .select("avatar_id, owner_id, lead_status, email_status, linkedin_stage, call_status"),
  ]);

  if (!avatars) return [];

  const profilesById = new Map<string, Profile>(
    (profiles ?? []).map((p) => [p.id, p as Profile])
  );

  return avatars.map((avatar: Avatar) => {
    const avatarLeads = (leads ?? []).filter((l) => l.avatar_id === avatar.id);

    // Owner split
    const ownerCounts = new Map<string | null, number>();
    for (const lead of avatarLeads) {
      ownerCounts.set(lead.owner_id, (ownerCounts.get(lead.owner_id) ?? 0) + 1);
    }
    const owner_split = Array.from(ownerCounts.entries()).map(([owner_id, count]) => ({
      display_name: owner_id ? profilesById.get(owner_id)?.display_name ?? "Unknown" : "Unassigned",
      count,
    }));

    // Progress glance:
    //  contacted = any non-default state on email/linkedin/call
    //  replied   = email_status = 'replied'
    //  won       = lead_status = 'won'
    let contacted = 0,
      replied = 0,
      won = 0;
    for (const l of avatarLeads) {
      const wasContacted =
        l.email_status !== "none" ||
        l.linkedin_stage !== "none" ||
        l.call_status !== "not_called";
      if (wasContacted) contacted++;
      if (l.email_status === "replied") replied++;
      if (l.lead_status === "won") won++;
    }

    return { ...avatar, owner_split, contacted, replied, won } as AvatarWithStats;
  });
}

/**
 * Check which of the given emails already exist in OTHER avatars.
 * Returns: { totalDuplicates, perAvatar: [{avatarId, avatarName, count}] }
 */
export async function checkDuplicateEmails(emails: string[]) {
  if (emails.length === 0) {
    return { totalDuplicates: 0, perAvatar: [] as { avatarId: string; avatarName: string; count: number }[] };
  }

  const supabase = await createClient();
  const normalised = Array.from(new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean)));

  // Postgres `in` filter has a length limit; chunk into 500-email batches.
  const chunks: string[][] = [];
  for (let i = 0; i < normalised.length; i += 500) chunks.push(normalised.slice(i, i + 500));

  type DupRow = { email: string; avatar_id: string; avatars: { name: string } | null };
  const all: DupRow[] = [];
  for (const chunk of chunks) {
    const { data, error } = await supabase
      .from("leads")
      .select("email, avatar_id, avatars(name)")
      .in("email", chunk);
    if (error) throw new Error(error.message);
    if (data) all.push(...(data as unknown as DupRow[]));
  }

  const perAvatarMap = new Map<string, { name: string; emails: Set<string> }>();
  for (const row of all) {
    if (!perAvatarMap.has(row.avatar_id)) {
      perAvatarMap.set(row.avatar_id, { name: row.avatars?.name ?? "—", emails: new Set() });
    }
    perAvatarMap.get(row.avatar_id)!.emails.add(row.email.toLowerCase());
  }

  const dupEmails = new Set(all.map((r) => r.email.toLowerCase()));

  return {
    totalDuplicates: dupEmails.size,
    perAvatar: Array.from(perAvatarMap.entries()).map(([avatarId, v]) => ({
      avatarId,
      avatarName: v.name,
      count: v.emails.size,
    })),
  };
}

export interface NewLeadInput {
  name: string;
  email: string;
  company: string | null;
  title: string | null;
  linkedin_url: string | null;
  phone: string | null;
  raw_data: Record<string, unknown>;
}

/**
 * Create a new Avatar with all its leads in one operation.
 * Returns the new avatar's id so the caller can redirect.
 */
export async function createAvatar(input: {
  name: string;
  visibleColumns: string[];
  leads: NewLeadInput[];
}): Promise<string> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: avatar, error: avatarError } = await supabase
    .from("avatars")
    .insert({
      name: input.name,
      created_by: user.id,
      visible_columns: input.visibleColumns,
      source: "Apollo",
    })
    .select()
    .single();

  if (avatarError || !avatar) throw new Error(avatarError?.message ?? "Failed to create avatar");

  // Insert leads in batches of 500.
  const BATCH = 500;
  for (let i = 0; i < input.leads.length; i += BATCH) {
    const slice = input.leads.slice(i, i + BATCH);
    const { error } = await supabase.from("leads").insert(
      slice.map((l) => ({ ...l, avatar_id: avatar.id }))
    );
    if (error) throw new Error(`Inserting leads ${i}-${i + slice.length}: ${error.message}`);
  }

  revalidatePath("/");
  return avatar.id;
}

/**
 * Wrapper that also handles the redirect, used by client form submit.
 */
export async function createAvatarAndRedirect(input: {
  name: string;
  visibleColumns: string[];
  leads: NewLeadInput[];
}): Promise<void> {
  const id = await createAvatar(input);
  revalidatePath("/");
  redirect(`/avatars/${id}/master`);
}
