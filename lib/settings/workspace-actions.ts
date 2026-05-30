"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { WorkspaceSettings } from "@/lib/types";

export async function getWorkspaceSettings(): Promise<WorkspaceSettings | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    console.error("getWorkspaceSettings failed", error);
    return null;
  }
  return data;
}

type UpdatableKey =
  | "smartlead_api_key"
  | "anthropic_api_key"
  | "apify_token"
  | "icebreaker_prompt";

export async function updateWorkspaceSetting(
  key: UpdatableKey,
  value: string,
): Promise<{ error?: string; success?: true }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Treat empty strings as clearing the key (but never clear the prompt).
  const next = value.trim();
  if (key === "icebreaker_prompt" && next.length === 0) {
    return { error: "Icebreaker prompt can't be empty." };
  }

  const { error } = await supabase
    .from("workspace_settings")
    .update({
      [key]: key === "icebreaker_prompt" ? next : next.length === 0 ? null : next,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { success: true };
}
