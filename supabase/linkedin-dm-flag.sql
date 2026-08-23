-- Phase 5: quality flags raised while writing the messages.
-- Already applied to the live database on 2026-08-22; kept here so the repo
-- has the full history. Safe to re-run.
--
-- 'thin'           = almost nothing usable on the profile; check before sending
-- 'not_accounting' = does not look like they work at an accounting firm
--
-- Deliberately a flag rather than an automatic unqualify. The judgement comes
-- from a model reading a scraped profile, and auto-disqualifying hundreds of
-- leads on that basis is not reversible by eye.

alter table leads
  add column if not exists linkedin_dm_flag text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'leads_linkedin_dm_flag_check'
  ) then
    alter table leads add constraint leads_linkedin_dm_flag_check
      check (linkedin_dm_flag in ('thin','not_accounting'));
  end if;
end$$;
