-- Hide avatars from the lists without deleting anything.
-- Already applied to the live database on 2026-09-05; kept here so the repo
-- has the full history. Safe to re-run, though the two updates at the bottom
-- will re-apply the current hide/show choice.
--
-- A flag rather than a delete: the leads, messages and scraped material all
-- stay, a hidden avatar is still reachable by its direct URL, and unhiding is
-- one update.

alter table avatars
  add column if not exists hidden boolean not null default false;

create index if not exists avatars_visible_idx on avatars (created_at) where not hidden;

-- Hide everything except the campaign currently being worked on.
update avatars set hidden = true  where name <> 'Sahil Leads';
update avatars set hidden = false where name =  'Sahil Leads';
