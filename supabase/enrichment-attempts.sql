-- Track how many times we've tried to enrich a lead. The cron's auto-retry
-- of plan-scoped failed leads needs a cap, otherwise a lead that's truly
-- unenrichable (no website, dead LinkedIn) blocks every tick.
--
-- Reset to 0 when the user explicitly requeues (Generate icebreakers).

alter table leads
  add column if not exists enrichment_attempts int not null default 0;

-- Reset any existing failed leads so they get a fresh try with the new cap.
update leads
   set enrichment_attempts = 0
 where enrichment_status in ('pending', 'failed');
