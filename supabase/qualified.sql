-- Phase 2 / Step 1 — Add Qualified flag to leads + supporting indexes.
-- Run this in your Supabase SQL Editor.

-- ─── Enums ────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'qualified_status') then
    create type qualified_status as enum ('qualified', 'unqualified');
  end if;

  if not exists (select 1 from pg_type where typname = 'unqualified_reason') then
    create type unqualified_reason as enum (
      'wrong_fit',
      'no_budget',
      'not_decision_maker',
      'cant_reach',
      'other'
    );
  end if;
end$$;

-- ─── Columns ──────────────────────────────────────────────────────────────
alter table leads
  add column if not exists qualified qualified_status not null default 'qualified',
  add column if not exists unqualified_reason unqualified_reason,
  add column if not exists unqualified_at timestamptz,
  add column if not exists unqualified_by uuid references auth.users(id) on delete set null;

-- ─── Indexes for channel queries (Phase 2 Step 3+) ───────────────────────
create index if not exists leads_avatar_qualified_idx
  on leads (avatar_id, qualified);

create index if not exists leads_avatar_owner_qualified_idx
  on leads (avatar_id, owner_id, qualified);
