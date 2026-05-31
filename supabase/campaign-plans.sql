-- Phase 5: campaign planner.
-- Plans are per-avatar buckets of leads heading to one Smartlead campaign.
-- A lead belongs to at most one plan (locked); reassigning moves it.

create table if not exists campaign_plans (
  id                     uuid primary key default gen_random_uuid(),
  avatar_id              uuid not null references avatars(id) on delete cascade,
  name                   text not null,
  target_lead_count      int not null default 0 check (target_lead_count >= 0),
  smartlead_campaign_id  text,
  status                 text not null default 'draft'
                         check (status in ('draft','enriching','ready','pushed','done')),
  notes                  text,
  created_by             uuid references auth.users(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists campaign_plans_avatar_idx on campaign_plans(avatar_id);

alter table campaign_plans enable row level security;

create policy "Authenticated users can read campaign_plans"
  on campaign_plans for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert campaign_plans"
  on campaign_plans for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update campaign_plans"
  on campaign_plans for update
  using (auth.role() = 'authenticated');

create policy "Authenticated users can delete campaign_plans"
  on campaign_plans for delete
  using (auth.role() = 'authenticated');

-- Foreign key from leads to a plan. Nullable: most leads aren't in a plan yet.
alter table leads
  add column if not exists campaign_plan_id uuid references campaign_plans(id) on delete set null;

create index if not exists leads_campaign_plan_idx on leads(campaign_plan_id);
