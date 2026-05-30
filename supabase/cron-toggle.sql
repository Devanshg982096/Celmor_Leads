-- Phase 4.5: pause/resume control for the auto-enrich cron.
-- When false, /api/enrich/tick exits as a no-op instead of doing any work.

alter table workspace_settings
  add column if not exists cron_enabled boolean not null default true;
