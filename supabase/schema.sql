-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor → New query)

-- ─── ENUMS ──────────────────────────────────────────────────────────────────
create type email_status as enum ('none', 'smartlead_sent', 'replied', 'bounced');
create type linkedin_stage as enum (
  'none', 'connection_sent', 'connection_accepted',
  'first_message', 'first_followup', 'second_followup', 'third_followup', 'dead'
);
create type call_status as enum ('not_called', 'called', 'voicemail', 'reached');
create type lead_status as enum ('new', 'active', 'unqualified', 'won', 'dead');

-- ─── AVATARS ─────────────────────────────────────────────────────────────────
create table avatars (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  created_at      timestamptz not null default now(),
  created_by      uuid not null references auth.users(id) on delete cascade,
  source          text not null default 'Apollo',
  visible_columns jsonb not null default '["name","email","company","linkedin_url"]'::jsonb,
  total_leads     integer not null default 0
);

alter table avatars enable row level security;

create policy "Authenticated users can read avatars"
  on avatars for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert avatars"
  on avatars for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update avatars"
  on avatars for update
  using (auth.role() = 'authenticated');

-- ─── LEADS ───────────────────────────────────────────────────────────────────
create table leads (
  id                        uuid primary key default gen_random_uuid(),
  avatar_id                 uuid not null references avatars(id) on delete cascade,
  owner_id                  uuid references auth.users(id) on delete set null,
  name                      text not null,
  email                     text not null,
  company                   text,
  title                     text,
  linkedin_url              text,
  phone                     text,
  raw_data                  jsonb not null default '{}'::jsonb,
  email_status              email_status not null default 'none',
  linkedin_stage            linkedin_stage not null default 'none',
  call_status               call_status not null default 'not_called',
  lead_status               lead_status not null default 'new',
  linkedin_stage_updated_at timestamptz,
  email_status_updated_at   timestamptz,
  call_status_updated_at    timestamptz,
  lead_status_updated_at    timestamptz,
  notes                     text,
  created_at                timestamptz not null default now()
);

alter table leads enable row level security;

create policy "Authenticated users can read leads"
  on leads for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert leads"
  on leads for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update leads"
  on leads for update
  using (auth.role() = 'authenticated');

-- ─── ACTIVITY LOG ────────────────────────────────────────────────────────────
create table activity_log (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references leads(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  action     text not null,
  created_at timestamptz not null default now()
);

alter table activity_log enable row level security;

create policy "Authenticated users can read activity_log"
  on activity_log for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert activity_log"
  on activity_log for insert
  with check (auth.role() = 'authenticated');

-- ─── FUNCTION: keep total_leads in sync ──────────────────────────────────────
create or replace function update_avatar_total_leads()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'INSERT' then
    update avatars set total_leads = total_leads + 1 where id = NEW.avatar_id;
  elsif TG_OP = 'DELETE' then
    update avatars set total_leads = total_leads - 1 where id = OLD.avatar_id;
  end if;
  return null;
end;
$$;

create trigger trg_leads_total
  after insert or delete on leads
  for each row execute function update_avatar_total_leads();
