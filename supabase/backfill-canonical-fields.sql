-- Backfill canonical leads fields (linkedin_url, company, phone) from raw_data
-- for any rows imported BEFORE the expanded Apollo mapping. Safe to run more
-- than once — only updates rows where the canonical field is currently empty.

-- ─── LinkedIn URL ────────────────────────────────────────────────────────
update leads
set linkedin_url = coalesce(
  nullif(raw_data->>'linkedin_link',         ''),
  nullif(raw_data->>'linkedin_url',          ''),
  nullif(raw_data->>'linkedin_profile',      ''),
  nullif(raw_data->>'person_linkedin_url',   ''),
  nullif(raw_data->>'person_linkedin_link',  '')
)
where (linkedin_url is null or linkedin_url = '')
  and coalesce(
    nullif(raw_data->>'linkedin_link',        ''),
    nullif(raw_data->>'linkedin_url',         ''),
    nullif(raw_data->>'linkedin_profile',     ''),
    nullif(raw_data->>'person_linkedin_url',  ''),
    nullif(raw_data->>'person_linkedin_link', '')
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

-- ─── Phone — fall back through person fields, then Company Phone Number ──
-- Order matches the new NewAvatarFlow resolution:
--   phone → work_direct_phone → direct_phone → mobile_phone → mobile
--   → company_phone (last resort for UK accountancy outreach use case)
update leads
set phone = coalesce(
  nullif(raw_data->>'phone',                ''),
  nullif(raw_data->>'work_direct_phone',    ''),
  nullif(raw_data->>'direct_phone',         ''),
  nullif(raw_data->>'mobile_phone',         ''),
  nullif(raw_data->>'mobile',               ''),
  nullif(raw_data->>'company_phone',        ''),
  nullif(raw_data->>'company_phone_number', '')
)
where (phone is null or phone = '')
  and coalesce(
    nullif(raw_data->>'phone',                ''),
    nullif(raw_data->>'work_direct_phone',    ''),
    nullif(raw_data->>'direct_phone',         ''),
    nullif(raw_data->>'mobile_phone',         ''),
    nullif(raw_data->>'mobile',               ''),
    nullif(raw_data->>'company_phone',        ''),
    nullif(raw_data->>'company_phone_number', '')
  ) is not null;
