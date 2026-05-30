-- Phase 1: workspace_settings + enrichment columns on leads
-- Run in Supabase SQL Editor.

-- ─── WORKSPACE SETTINGS (singleton row) ──────────────────────────────────────
-- Single shared row holds API keys + the editable icebreaker prompt.
-- The CHECK on id enforces a single-row table.
create table if not exists workspace_settings (
  id                    int primary key default 1 check (id = 1),
  smartlead_api_key     text,
  anthropic_api_key     text,
  apify_token           text,
  icebreaker_prompt     text not null default
    'You write short, sharp cold-email icebreakers for outreach to UK accountancy firm owners (partners / managing directors of small-to-mid-sized accountancy practices, typically 2-50 staff).

You will be given:
- The lead''s name, job title, company, and LinkedIn summary
- A short summary of the firm''s website (services, niches, recent posts)

Write a JSON object with exactly two fields:
{
  "subject": "<6 words max, lowercase except proper nouns, no clickbait, no emojis, feels like it came from one person to another>",
  "icebreaker": "<one or two sentences, max 35 words, opens the email. Reference one specific, non-generic detail from their website or LinkedIn (a niche they serve, a recent post, the firm''s positioning, their background). Sound human, British, dry, never sycophantic. Never say ''I came across your profile'' or ''I noticed''. No flattery. No exclamation marks.>"
}

Rules:
- If you cannot find a specific detail, write a thoughtful comment about something concrete you DO see (e.g., the firm''s niche or a service they emphasise) rather than inventing.
- Never mention compliance, MTD, Making Tax Digital, or generic accountancy pain points unless the source material specifically discusses them.
- Output ONLY the JSON. No preamble, no markdown fences.',
  updated_at            timestamptz not null default now()
);

alter table workspace_settings enable row level security;

create policy "Authenticated users can read workspace_settings"
  on workspace_settings for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can update workspace_settings"
  on workspace_settings for update
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert workspace_settings"
  on workspace_settings for insert
  with check (auth.role() = 'authenticated');

-- Seed the singleton row if missing
insert into workspace_settings (id) values (1)
on conflict (id) do nothing;

-- ─── ENRICHMENT COLUMNS ON LEADS ─────────────────────────────────────────────
alter table leads add column if not exists website_summary    text;
alter table leads add column if not exists linkedin_summary   text;
alter table leads add column if not exists subject_line       text;
alter table leads add column if not exists icebreaker         text;
alter table leads add column if not exists enriched_at        timestamptz;
alter table leads add column if not exists enrichment_status  text
  check (enrichment_status in ('pending','enriching','done','failed'));
alter table leads add column if not exists enrichment_error   text;
alter table leads add column if not exists smartlead_campaign_id text;
alter table leads add column if not exists smartlead_lead_id     text;

-- Speed up the cron picker
create index if not exists leads_enrichment_pick_idx
  on leads (enrichment_status, qualified)
  where enrichment_status is null or enrichment_status = 'failed';
