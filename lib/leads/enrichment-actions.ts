"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { enrichLead } from "@/lib/enrichment";

export async function enrichLeadAction(leadId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not authenticated" };

  const result = await enrichLead(leadId, supabase);

  // Log activity regardless of outcome so users can see what was attempted.
  await supabase.from("activity_log").insert({
    lead_id: leadId,
    user_id: user.id,
    action: result.ok ? "Enriched (icebreaker generated)" : `Enrichment failed: ${result.error}`,
  });

  revalidatePath("/", "layout");
  return result;
}
