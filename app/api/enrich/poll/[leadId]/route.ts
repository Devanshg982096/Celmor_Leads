import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { finalizeEnrichment } from "@/lib/enrichment";

export const dynamic = "force-dynamic";

/**
 * Client polls this while a lead is enriching. Each call asks Apify whether
 * the runs have finished and, if so, runs Claude + persists the result.
 * Returns the up-to-date status fields so the drawer can re-render.
 */
export async function GET(
  _req: Request,
  context: { params: Promise<{ leadId: string }> },
) {
  const { leadId } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const result = await finalizeEnrichment(leadId, supabase);

  // Re-read the row so the client gets the canonical state regardless of
  // whether finalize promoted it or it was already there.
  const { data } = await supabase
    .from("leads")
    .select(
      "enrichment_status, enrichment_error, subject_line, icebreaker, enriched_at",
    )
    .eq("id", leadId)
    .maybeSingle();

  return NextResponse.json({
    ok: "ok" in result ? result.ok : false,
    lead: data ?? null,
  });
}
