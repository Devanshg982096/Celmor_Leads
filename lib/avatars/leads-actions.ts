"use server";

import { createClient } from "@/lib/supabase/server";
import type { Lead, Profile } from "@/lib/types";

export async function listLeadsForAvatar(avatarId: string): Promise<Lead[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("avatar_id", avatarId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Lead[];
}

export async function listProfiles(): Promise<Profile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("*");
  if (error) throw new Error(error.message);
  return (data ?? []) as Profile[];
}
