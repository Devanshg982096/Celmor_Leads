"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateDisplayName(displayName: string) {
  const name = displayName.trim();
  if (name.length === 0) return { error: "Display name can't be empty." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Update profile row (used everywhere in the UI)
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ display_name: name })
    .eq("id", user.id);
  if (profileError) return { error: profileError.message };

  // Also update the auth user metadata so newly-created profile rows for
  // future signups would inherit the new name if backfilled.
  await supabase.auth.updateUser({ data: { display_name: name } });

  revalidatePath("/", "layout");
  return { success: true };
}

export async function updatePassword(newPassword: string) {
  if (newPassword.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: error.message };
  return { success: true };
}
