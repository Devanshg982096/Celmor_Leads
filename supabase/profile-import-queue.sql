-- Saved LinkedIn connection queue. Additive and safe to rerun.
create table if not exists public.profile_import_queue (
  id uuid primary key default gen_random_uuid(),
  avatar_id uuid not null references public.avatars(id) on delete cascade,
  linkedin_url text not null,
  added_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  connection_sent_at timestamptz not null default now(),
  status text not null default 'draft' check (status in ('draft','queued','processing','done','failed','cancelled')),
  run_id text,
  dataset_id text,
  lease_token uuid,
  lease_until timestamptz,
  error text,
  lead_id uuid references public.leads(id) on delete set null,
  completed_at timestamptz,
  unique(avatar_id, linkedin_url)
);
alter table public.profile_import_queue enable row level security;
drop policy if exists "Workspace users manage profile queue" on public.profile_import_queue;
create policy "Workspace users manage profile queue" on public.profile_import_queue
  for all to authenticated using (true) with check (true);
grant select, insert, update on public.profile_import_queue to authenticated;
create index if not exists profile_queue_active on public.profile_import_queue(avatar_id, created_at)
  where status in ('queued','processing');

-- Serialize claims within an Avatar, including requests from multiple browser tabs.
create or replace function public.claim_profile_import(p_avatar uuid)
returns setof public.profile_import_queue language plpgsql security invoker set search_path = public as $$
declare job public.profile_import_queue;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_avatar::text, 177));
  select * into job from public.profile_import_queue
    where avatar_id = p_avatar and status in ('queued','processing')
    order by (status = 'processing') desc, created_at, id limit 1 for update;
  if not found then return; end if;
  if job.lease_until > now() then return; end if;
  -- A lost response after starting Apify must not silently buy a second run.
  if job.status = 'processing' and job.run_id is null then
    update public.profile_import_queue set status='failed', lease_until=null, lease_token=null,
      error='The lookup was interrupted before its run ID was saved. Check Apify before retrying; retrying may start another paid lookup.' where id=job.id;
    return;
  end if;
  return query update public.profile_import_queue set status='processing',
    lease_token=gen_random_uuid(), lease_until=now()+interval '90 seconds', error=null
    where id=job.id returning *;
end $$;

-- Completing a job and creating/updating the lead are one transaction.
-- p_draft=null checks for an existing lead before spending Apify credits.
create or replace function public.finish_profile_import(p_job uuid, p_lease uuid, p_draft jsonb default null)
returns uuid language plpgsql security invoker set search_path = public as $$
declare job public.profile_import_queue; existing public.leads; result_id uuid;
begin
  select * into job from public.profile_import_queue where id=p_job and status='processing' and lease_token=p_lease for update;
  if not found then return null; end if;
  select * into existing from public.leads where avatar_id=job.avatar_id and (
    split_part(trim(trailing '/' from split_part(split_part(lower(coalesce(linkedin_url,'')), '?', 1), '#', 1)), '/in/', 2) =
    split_part(job.linkedin_url, '/in/', 2)
    or (coalesce(p_draft->>'email','') <> '' and lower(email)=lower(p_draft->>'email'))
  ) order by created_at limit 1 for update;
  if found then
    result_id := existing.id;
    update public.leads set linkedin_stage='connection_sent', linkedin_stage_updated_at=job.connection_sent_at
      where id=result_id and linkedin_stage='none';
  elsif p_draft is null then
    return null;
  else
    if coalesce(trim(p_draft->>'name'),'')='' then raise exception 'Profile has no name'; end if;
    insert into public.leads(id,avatar_id,name,email,company,title,phone,linkedin_url,linkedin_stage,linkedin_stage_updated_at,raw_data)
    values(job.id,job.avatar_id,p_draft->>'name',coalesce(p_draft->>'email',''),nullif(p_draft->>'company',''),
      nullif(p_draft->>'title',''),nullif(p_draft->>'phone',''),job.linkedin_url,'connection_sent',job.connection_sent_at,
      p_draft || jsonb_build_object('source','Apify LinkedIn','source_url',job.linkedin_url,'linkedin_url',job.linkedin_url,
        'apify_run_id',job.run_id,'imported_at',now(),'email_verification',case when coalesce(p_draft->>'email','')='' then 'not_found' else 'unverified' end))
    returning id into result_id;
  end if;
  update public.profile_import_queue set status='done',lead_id=result_id,completed_at=now(),lease_token=null,lease_until=null,error=null where id=job.id;
  insert into public.activity_log(lead_id,user_id,action) values(result_id,job.added_by,'Recorded LinkedIn connection from URL list');
  return result_id;
end $$;
revoke all on function public.claim_profile_import(uuid) from public, anon;
revoke all on function public.finish_profile_import(uuid,uuid,jsonb) from public, anon;
grant execute on function public.claim_profile_import(uuid) to authenticated, service_role;
grant execute on function public.finish_profile_import(uuid,uuid,jsonb) to authenticated, service_role;
notify pgrst, 'reload schema';
