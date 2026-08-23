-- Phase 4: LinkedIn post scraping.
-- Already applied to the live database on 2026-08-22; kept here so the repo
-- has the full history. Safe to re-run.
--
-- Posts are scraped by a second Apify actor (harvestapi/linkedin-profile-posts,
-- $0.002 per post) alongside the existing profile scraper, because no single
-- actor returns both.
--
-- They live in their own column rather than being folded into
-- linkedin_summary so that:
--   - the existing email icebreaker behaviour is unchanged
--   - "profile scraped but no posts" is distinguishable from "never scraped"

alter table leads
  add column if not exists linkedin_posts_summary text,
  add column if not exists linkedin_posts_run_id  text;
