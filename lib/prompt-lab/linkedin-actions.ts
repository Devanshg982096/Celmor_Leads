"use server";

import { createClient } from "@/lib/supabase/server";
import {
  writeLinkedInDm,
  buildSourceBlock,
  hasScrapedMaterial,
  type DmSource,
} from "@/lib/enrichment/linkedin-dm-writer";
import { fillTemplate, DM_SLOTS } from "@/lib/leads/linkedin-dm";
import { getLeadValue } from "@/lib/leads-columns";
import type { Lead, LinkedInDmSlot } from "@/lib/types";

export interface LabAvatar {
  id: string;
  name: string;
  leadCount: number;
}

export interface LabLead {
  id: string;
  name: string;
  company: string | null;
  title: string | null;
  /** Has been scraped, so a preview will be representative. */
  hasSource: boolean;
  /** Already has messages written, so you can compare against a fresh run. */
  hasMessages: boolean;
}

/** Campaigns to choose from, richest first. */
export async function listLabAvatars(): Promise<LabAvatar[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("avatars")
    .select("id, name, total_leads")
    .eq("hidden", false)
    .order("name", { ascending: true });

  return (data ?? []).map((a: Record<string, unknown>) => ({
    id: a.id as string,
    name: a.name as string,
    leadCount: (a.total_leads as number) ?? 0,
  }));
}

/**
 * Leads in one campaign, scraped ones first.
 *
 * Unscraped leads are still offered rather than hidden: previewing one is the
 * fastest way to see how thin a message looks before you've paid to scrape
 * anything, which is a genuinely useful thing to check.
 */
export async function listLabLeads(avatarId: string): Promise<LabLead[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leads")
    .select(
      "id, name, company, title, website_summary, linkedin_summary, linkedin_posts_summary, linkedin_open_first",
    )
    .eq("avatar_id", avatarId)
    .eq("qualified", "qualified")
    .not("linkedin_url", "is", null)
    .order("created_at", { ascending: true })
    .limit(300);

  const rows = (data ?? []).map((l: Record<string, unknown>) => {
    const has = (k: string) =>
      typeof l[k] === "string" && (l[k] as string).trim().length > 0;
    return {
      id: l.id as string,
      name: l.name as string,
      company: (l.company as string | null) ?? null,
      title: (l.title as string | null) ?? null,
      hasSource:
        has("website_summary") || has("linkedin_summary") || has("linkedin_posts_summary"),
      hasMessages: has("linkedin_open_first"),
    };
  });

  // Scraped leads first — they give a representative preview.
  return rows.sort((a, b) => Number(b.hasSource) - Number(a.hasSource));
}

export interface LabTemplates {
  first: string;
  followup_1: string;
  followup_2: string;
  followup_3: string;
}

export interface LabMessage {
  slot: LinkedInDmSlot;
  label: string;
  text: string;
  /** True when the model chose to add nothing, so only fixed text remains. */
  fixedOnly: boolean;
  /** True when no wording is saved for this slot at all. */
  missingTemplate: boolean;
}

export type LabPreview =
  | {
      ok: true;
      lead: { name: string; company: string | null; title: string | null };
      hasSource: boolean;
      /** Exactly what the model was shown, for when a line looks wrong. */
      sourceBlock: string;
      quality: "good" | "thin";
      isAccountingFirm: boolean;
      messages: LabMessage[];
    }
  | { ok: false; error: string };

/**
 * Write all four messages for one lead and return them assembled, WITHOUT
 * saving anything.
 *
 * Takes the wording and rules as arguments rather than reading them back from
 * the database, so you can preview an unsaved edit. That is the entire point
 * of a lab.
 */
export async function previewLinkedInDmAction(
  rules: string,
  templates: LabTemplates,
  leadId: string,
): Promise<LabPreview> {
  if (!rules.trim()) return { ok: false, error: "The writing rules are empty." };
  if (!templates.first.trim()) {
    return { ok: false, error: "The first message has no wording yet." };
  }
  if (!templates.first.includes("[OPENING]")) {
    return {
      ok: false,
      error:
        "First message must contain [OPENING] — that's where the personalised paragraphs go.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { data: wsRow } = await supabase
    .from("workspace_settings")
    .select("anthropic_api_key")
    .eq("id", 1)
    .maybeSingle();
  const apiKey = wsRow?.anthropic_api_key as string | null;
  if (!apiKey) return { ok: false, error: "No Anthropic API key saved in Settings." };

  const { data: leadRow } = await supabase
    .from("leads")
    .select(
      "id, name, title, company, raw_data, website_summary, linkedin_summary, linkedin_posts_summary",
    )
    .eq("id", leadId)
    .maybeSingle();
  if (!leadRow) return { ok: false, error: "Lead not found." };

  const lead = leadRow as unknown as Lead;
  const source: DmSource = {
    name: lead.name,
    title: lead.title,
    company: lead.company,
    headline: getLeadValue(lead, "headline") || null,
    industry: getLeadValue(lead, "industry") || null,
    city: getLeadValue(lead, "city") || null,
    websiteSummary: lead.website_summary,
    linkedinSummary: lead.linkedin_summary,
    postsSummary: lead.linkedin_posts_summary,
  };

  try {
    // Pass the wording being previewed, unsaved edits included, so the lines
    // are written to fit the text you are currently looking at.
    const result = await writeLinkedInDm(source, rules, templates, apiKey);

    const openings: Record<LinkedInDmSlot, string> = {
      first: result.first,
      followup_1: result.followup_1,
      followup_2: result.followup_2,
      followup_3: result.followup_3,
    };

    const messages: LabMessage[] = DM_SLOTS.map(({ slot, label }) => {
      const template = (templates[slot] ?? "").trim();
      const opening = openings[slot] ?? "";
      if (!template) {
        return { slot, label, text: "", fixedOnly: false, missingTemplate: true };
      }
      return {
        slot,
        label,
        text: fillTemplate(template, lead.name, opening),
        fixedOnly: opening.trim().length === 0,
        missingTemplate: false,
      };
    });

    return {
      ok: true,
      lead: { name: lead.name, company: lead.company, title: lead.title },
      hasSource: hasScrapedMaterial(source),
      sourceBlock: buildSourceBlock(source),
      quality: result.quality,
      isAccountingFirm: result.isAccountingFirm,
      messages,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
