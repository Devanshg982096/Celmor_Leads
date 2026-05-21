-- Backfill canonical leads fields (linkedin_url, company, phone) from raw_data
-- for any rows imported BEFORE the expanded Apollo mapping. Safe to run more
-- than once — only updates rows where the canonical field is currently empty.

-- ─── LinkedIn URL ────────────────────────────────────────────────────────
update leads
set linkedin_url = coalesce(
  nullif(raw_data->>'linkedin_link', ''),
  nullif(raw_data->>'linkedin_url',  ''),
  nullif(raw_data->>'linkedin_profile', ''),
  nullif(raw_data->>'person_linkedin_url', '')
)
where (linkedin_url is null or linkedin_url = '')
  and coalesce(
    nullif(raw_data->>'linkedin_link', ''),
    nullif(raw_data->>'linkedin_url',  ''),
    nullif(raw_data->>'linkedin_profile', ''),
    nullif(raw_data->>'person_linkedin_url', '')
  ) is not null;

-- ─── Company ─────────────────────────────────────────────────────────────
update leads
set company = coalesce(
  nullif(raw_data->>'company_name', ''),
  nullif(raw_data->>'company',      '')
)
where (company is null or company = '')
  and coalesce(
    nullif(raw_data->>'company_name', ''),
    nullif(raw_data->>'company',      '')
  ) is not null;

-- ─── Phone (try work direct first, then mobile) ──────────────────────────
update leads
set phone = coalesce(
  nullif(raw_data->>'phone',              ''),
  nullif(raw_data->>'work_direct_phone',  ''),
  nullif(raw_data->>'direct_phone',       ''),
  nullif(raw_data->>'mobile_phone',       ''),
  nullif(raw_data->>'mobile',             '')
)
where (phone is null or phone = '')
  and coalesce(
    nullif(raw_data->>'phone',              ''),
    nullif(raw_data->>'work_direct_phone',  ''),
    nullif(raw_data->>'direct_phone',       ''),
    nullif(raw_data->>'mobile_phone',       ''),
    nullif(raw_data->>'mobile',             '')
  ) is not null;
