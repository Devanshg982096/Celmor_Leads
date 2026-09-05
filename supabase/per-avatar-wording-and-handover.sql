-- Per-campaign LinkedIn wording, plus the two-week handover.
-- Additive and safe to rerun.

-- 1. Each campaign gets its own message wording and writing rules.
--    Null means "not set yet" and falls back to the workspace defaults, so
--    nothing changes for a campaign until someone edits it.
alter table public.avatars
  add column if not exists linkedin_dm_prompt   text,
  add column if not exists linkedin_dm_template text,
  add column if not exists linkedin_followup_1  text,
  add column if not exists linkedin_followup_2  text,
  add column if not exists linkedin_followup_3  text;

-- Seed every existing campaign from the workspace wording it was already
-- using, so behaviour is unchanged on the day this ships.
update public.avatars a set
  linkedin_dm_prompt   = coalesce(a.linkedin_dm_prompt,   w.linkedin_dm_prompt),
  linkedin_dm_template = coalesce(a.linkedin_dm_template, w.linkedin_dm_template),
  linkedin_followup_1  = coalesce(a.linkedin_followup_1,  w.linkedin_followup_1),
  linkedin_followup_2  = coalesce(a.linkedin_followup_2,  w.linkedin_followup_2),
  linkedin_followup_3  = coalesce(a.linkedin_followup_3,  w.linkedin_followup_3)
from public.workspace_settings w where w.id = 1;

-- 2. A copy made by a handover remembers where it came from, so the lead can
--    show "also being worked in <other campaign>".
alter table public.leads
  add column if not exists handed_over_from uuid references public.leads(id) on delete set null;
create index if not exists leads_handed_over_from_idx on public.leads(handed_over_from)
  where handed_over_from is not null;

-- 3. The vanity part of a LinkedIn URL, which is the only reliable way to tell
--    two rows are the same human. Immutable so it can back an index.
create or replace function public.linkedin_slug(p_url text)
returns text language sql immutable set search_path = public as $$
  select nullif(
    split_part(
      trim(trailing '/' from split_part(split_part(lower(coalesce(p_url, '')), '?', 1), '#', 1)),
      '/in/', 2),
    '');
$$;
create index if not exists leads_linkedin_slug_idx on public.leads(public.linkedin_slug(linkedin_url))
  where linkedin_url is not null;

-- 4. The handover itself. Copies rather than moves: the sender who is already
--    connected keeps their row and their conversation, and the person taking
--    over gets a fresh row starting at "not started" so they send their own
--    connection request.
--
--    The expensive parts (scraped profile, posts, written openings) are carried
--    across, so a handover costs nothing in Apify or Anthropic credits.
create or replace function public.hand_over_leads(
  p_from uuid, p_to uuid, p_owner uuid default null, p_actor uuid default null)
returns table(copied integer, already_there integer)
language plpgsql security invoker set search_path = public as $$
declare n_copied integer; n_skipped integer;
begin
  if p_from = p_to then raise exception 'Pick two different campaigns'; end if;

  -- One handover at a time per target, so a double-click cannot duplicate rows.
  perform pg_advisory_xact_lock(hashtextextended(p_to::text, 991));

  with src as (
    select l.* from public.leads l
    where l.avatar_id = p_from
      and public.linkedin_slug(l.linkedin_url) is not null
      and l.qualified = 'qualified'
  ), dup as (
    select count(*)::integer c from src s
    where exists (select 1 from public.leads t where t.avatar_id = p_to
                  and public.linkedin_slug(t.linkedin_url) = public.linkedin_slug(s.linkedin_url))
  ), inserted as (
    insert into public.leads (
      avatar_id, owner_id, name, email, company, title, linkedin_url, phone, raw_data,
      website_summary, linkedin_summary, linkedin_posts_summary,
      linkedin_open_first, linkedin_open_followup_1, linkedin_open_followup_2, linkedin_open_followup_3,
      linkedin_dm_generated_at, linkedin_dm_status, linkedin_dm_flag,
      enriched_at, enrichment_status, handed_over_from)
    select
      p_to, p_owner, s.name, s.email, s.company, s.title, s.linkedin_url, s.phone, s.raw_data,
      s.website_summary, s.linkedin_summary, s.linkedin_posts_summary,
      s.linkedin_open_first, s.linkedin_open_followup_1, s.linkedin_open_followup_2, s.linkedin_open_followup_3,
      s.linkedin_dm_generated_at, s.linkedin_dm_status, s.linkedin_dm_flag,
      s.enriched_at, s.enrichment_status, s.id
    from src s
    where not exists (select 1 from public.leads t where t.avatar_id = p_to
                      and public.linkedin_slug(t.linkedin_url) = public.linkedin_slug(s.linkedin_url))
    returning id
  ), logged as (
    insert into public.activity_log (lead_id, user_id, action)
    select i.id, p_actor, 'Handed over from another campaign' from inserted i
    where p_actor is not null
    returning 1
  )
  select (select count(*)::integer from inserted), (select c from dup) into n_copied, n_skipped;

  return query select n_copied, n_skipped;
end $$;
revoke all on function public.hand_over_leads(uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.hand_over_leads(uuid, uuid, uuid, uuid) to authenticated, service_role;

-- 5. A lead imported from a pasted URL now belongs to whoever pasted it.
--    Without this the two-person split has nothing to sort on.
create or replace function public.finish_profile_import(p_job uuid, p_lease uuid, p_draft jsonb default null)
returns uuid language plpgsql security invoker set search_path = public as $$
declare job public.profile_import_queue; existing public.leads; result_id uuid;
begin
  select * into job from public.profile_import_queue where id=p_job and status='processing' and lease_token=p_lease for update;
  if not found then return null; end if;
  select * into existing from public.leads where avatar_id=job.avatar_id and (
    public.linkedin_slug(linkedin_url) = public.linkedin_slug(job.linkedin_url)
    or (coalesce(p_draft->>'email','') <> '' and lower(email)=lower(p_draft->>'email'))
  ) order by created_at limit 1 for update;
  if found then
    result_id := existing.id;
    update public.leads set linkedin_stage='connection_sent', linkedin_stage_updated_at=job.connection_sent_at
      where id=result_id and linkedin_stage='none';
    -- An unowned lead becomes theirs; an owned one is left alone.
    update public.leads set owner_id=job.added_by where id=result_id and owner_id is null;
  elsif p_draft is null then
    return null;
  else
    if coalesce(trim(p_draft->>'name'),'')='' then raise exception 'Profile has no name'; end if;
    insert into public.leads(id,avatar_id,owner_id,name,email,company,title,phone,linkedin_url,linkedin_stage,linkedin_stage_updated_at,raw_data)
    values(job.id,job.avatar_id,job.added_by,p_draft->>'name',coalesce(p_draft->>'email',''),nullif(p_draft->>'company',''),
      nullif(p_draft->>'title',''),nullif(p_draft->>'phone',''),job.linkedin_url,'connection_sent',job.connection_sent_at,
      p_draft || jsonb_build_object('source','Apify LinkedIn','source_url',job.linkedin_url,'linkedin_url',job.linkedin_url,
        'apify_run_id',job.run_id,'imported_at',now(),'email_verification',case when coalesce(p_draft->>'email','')='' then 'not_found' else 'unverified' end))
    returning id into result_id;
  end if;
  update public.profile_import_queue set status='done',lead_id=result_id,completed_at=now(),lease_token=null,lease_until=null,error=null where id=job.id;
  insert into public.activity_log(lead_id,user_id,action) values(result_id,job.added_by,'Recorded LinkedIn connection from URL list');
  return result_id;
end $$;
revoke all on function public.finish_profile_import(uuid,uuid,jsonb) from public, anon;
grant execute on function public.finish_profile_import(uuid,uuid,jsonb) to authenticated, service_role;

notify pgrst, 'reload schema';

-- 6. The second sender's campaign. Wording is sample text for him to replace,
--    and the writing rules are copied from Sahil's so the openings still follow
--    the same house style.
insert into public.avatars (name, created_by, source, visible_columns, hidden,
  linkedin_dm_prompt, linkedin_dm_template, linkedin_followup_1, linkedin_followup_2, linkedin_followup_3)
select 'Kushal Leads', s.created_by, s.source, s.visible_columns, false,
  s.linkedin_dm_prompt, s.linkedin_dm_template, s.linkedin_followup_1, s.linkedin_followup_2, s.linkedin_followup_3
from public.avatars s where s.name = 'Sahil Leads'
and not exists (select 1 from public.avatars k where k.name = 'Kushal Leads');
