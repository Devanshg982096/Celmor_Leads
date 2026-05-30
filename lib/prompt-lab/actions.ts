"use server";

import { createClient } from "@/lib/supabase/server";
import { generateIcebreaker } from "@/lib/enrichment/claude";
import type { WorkspaceSettings } from "@/lib/types";

export interface PreviewLead {
  id: string;
  name: string;
  title: string | null;
  company: string | null;
  has_website: boolean;
  has_linkedin: boolean;
}

/**
 * Leads that already have at least one scraped source — these are the only
 * useful options to preview a prompt against because generation needs source
 * material to chew on. Most-recently-enriched first.
 */
export async function listLeadsForPreviewAction(): Promise<PreviewLead[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select("id, name, title, company, website_summary, linkedin_summary, enriched_at")
    .or("website_summary.not.is.null,linkedin_summary.not.is.null")
    .order("enriched_at", { ascending: false, nullsFirst: false })
    .limit(50);

  return (data ?? []).map((l: Record<string, unknown>) => ({
    id: l.id as string,
    name: l.name as string,
    title: (l.title as string | null) ?? null,
    company: (l.company as string | null) ?? null,
    has_website: typeof l.website_summary === "string" && (l.website_summary as string).length > 0,
    has_linkedin: typeof l.linkedin_summary === "string" && (l.linkedin_summary as string).length > 0,
  }));
}

export interface PreviewSources {
  name: string;
  title: string | null;
  company: string | null;
  website_summary: string | null;
  linkedin_summary: string | null;
}

export async function getPreviewSourcesAction(
  leadId: string,
): Promise<PreviewSources | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select("name, title, company, website_summary, linkedin_summary")
    .eq("id", leadId)
    .maybeSingle();
  if (!data) return null;
  return {
    name: data.name as string,
    title: (data.title as string | null) ?? null,
    company: (data.company as string | null) ?? null,
    website_summary: (data.website_summary as string | null) ?? null,
    linkedin_summary: (data.linkedin_summary as string | null) ?? null,
  };
}

/**
 * Run Claude against the given prompt + a lead's saved summaries. Does NOT
 * persist anything — purely a preview for prompt-lab.
 */
export async function previewIcebreakerAction(
  prompt: string,
  leadId: string,
): Promise<
  | { ok: true; subject: string; icebreaker: string }
  | { ok: false; error: string }
> {
  if (!prompt.trim()) return { ok: false, error: "Prompt is empty." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { data: wsRaw } = await supabase
    .from("workspace_settings")
    .select("anthropic_api_key")
    .eq("id", 1)
    .maybeSingle();
  const ws = wsRaw as Pick<WorkspaceSettings, "anthropic_api_key"> | null;
  if (!ws?.anthropic_api_key) {
    return { ok: false, error: "Anthropic key not set in Settings." };
  }

  const sources = await getPreviewSourcesAction(leadId);
  if (!sources) return { ok: false, error: "Lead not found." };
  if (!sources.website_summary && !sources.linkedin_summary) {
    return { ok: false, error: "Selected lead has no scraped sources yet." };
  }

  try {
    const result = await generateIcebreaker(
      {
        name: sources.name,
        title: sources.title,
        company: sources.company,
        websiteSummary: sources.website_summary,
        linkedinSummary: sources.linkedin_summary,
      },
      prompt,
      ws.anthropic_api_key,
    );
    return { ok: true, subject: result.subject, icebreaker: result.icebreaker };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
