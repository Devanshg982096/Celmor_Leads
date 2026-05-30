-- Phase 2.5: async enrichment — track Apify run IDs so we can return from
-- the server action in <2s and poll for completion.

alter table leads add column if not exists website_run_id          text;
alter table leads add column if not exists linkedin_run_id         text;
alter table leads add column if not exists enrichment_started_at   timestamptz;
