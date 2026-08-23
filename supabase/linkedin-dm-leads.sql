-- Phase 2: per-lead storage for the LinkedIn DM openings.
-- Already applied to the live database on 2026-08-22; kept here so the repo
-- has the full history. Safe to re-run.
--
-- We store the AI-written OPENINGS, not the finished messages. The fixed
-- wording is applied at display time from workspace_settings (see
-- lib/leads/linkedin-dm.ts). That way editing the fixed message in Settings
-- instantly updates every lead's message for free, instead of needing a
-- re-run of the AI across hundreds of leads.
--
-- An empty string is meaningful and distinct from null: null means "not
-- generated yet", empty means "the AI had nothing further to say, send the
-- fixed text alone".

alter table leads
  add column if not exists linkedin_open_first      text,
  add column if not exists linkedin_open_followup_1 text,
  add column if not exists linkedin_open_followup_2 text,
  add column if not exists linkedin_open_followup_3 text,
  add column if not exists linkedin_dm_generated_at timestamptz,
  add column if not exists linkedin_dm_status       text,
  add column if not exists linkedin_dm_error        text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'leads_linkedin_dm_status_check'
  ) then
    alter table leads add constraint leads_linkedin_dm_status_check
      check (linkedin_dm_status in ('pending','generating','done','failed'));
  end if;
end$$;

-- Phase 3's batch picker scans for leads still needing a message within one
-- avatar, so index the columns it filters on.
create index if not exists leads_linkedin_dm_pick_idx
  on leads (avatar_id, linkedin_dm_status)
  where qualified = 'qualified' and linkedin_url is not null;
