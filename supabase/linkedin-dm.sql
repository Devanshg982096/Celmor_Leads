-- Phase 1: LinkedIn DM section.
-- Adds the fixed message, three follow-up templates, and the personalisation
-- rules to workspace_settings. Run in the Supabase SQL Editor AFTER
-- workspace-settings.sql.
--
-- Deliberately idempotent and non-destructive: columns are added only if
-- missing, and the seed values are applied only where the column is still
-- null. Re-running this never overwrites wording that has since been edited
-- in Settings.

alter table workspace_settings
  add column if not exists linkedin_dm_prompt   text,
  add column if not exists linkedin_dm_template text,
  add column if not exists linkedin_followup_1  text,
  add column if not exists linkedin_followup_2  text,
  add column if not exists linkedin_followup_3  text;

-- ─── The fixed first message ────────────────────────────────────────────────
-- [NAME] is replaced with the lead's first name, [OPENING] with the two
-- personalised paragraphs. Everything else goes out exactly as written.
update workspace_settings set linkedin_dm_template = $tpl$Hi [NAME],

[OPENING]

We help accounting firms across the UK acquire 8+ new clients within 8 weeks of working with us, without investing thousands of pounds in marketing. (We only work with Accounting firms)

We guarantee results, and we work for free until we achieve what we've promised.

We recently helped Preston Accountants in London generate 18 qualified enquiries, resulting in 5 new limited company clients within 8 weeks.

Would you be interested in learning more?

Regards,
Sahil$tpl$
where id = 1 and linkedin_dm_template is null;

-- ─── Follow-up 1: gentle bump, leads on the risk reversal ───────────────────
update workspace_settings set linkedin_followup_1 = $f1$Hi [NAME],

[OPENING]

Floating this back up in case it got buried.

The reason I think it's worth two minutes: we work for free until we've delivered what we promised, so there's no downside on your side to finding out more.

Regards,
Sahil$f1$
where id = 1 and linkedin_followup_1 is null;

-- ─── Follow-up 2: adds the proof, offers value either way ───────────────────
update workspace_settings set linkedin_followup_2 = $f2$Hi [NAME],

[OPENING]

Last thing from me on this, then I'll leave you be.

We recently took Preston Accountants in London from cold to 18 qualified enquiries and 5 new limited company clients in 8 weeks. Happy to walk you through how, whether or not you end up working with us.

Regards,
Sahil$f2$
where id = 1 and linkedin_followup_2 is null;

-- ─── Follow-up 3: polite close ──────────────────────────────────────────────
update workspace_settings set linkedin_followup_3 = $f3$Hi [NAME],

[OPENING]

I'll stop here so I'm not cluttering your inbox.

If growth isn't a priority at the moment that's completely fair. If it becomes one later, my door is open.

All the best,
Sahil$f3$
where id = 1 and linkedin_followup_3 is null;

-- ─── The personalisation rules ──────────────────────────────────────────────
-- Phase 3 sends this to Claude along with what was scraped from the lead's
-- profile. It must return all four openings in one call, which is why the
-- "use a different detail for each" rule matters so much: without it, all
-- four messages reach for the same fact.
update workspace_settings set linkedin_dm_prompt = $p$You write the personalised opening lines for LinkedIn cold outreach to UK accounting firm owners (partners and managing directors of small-to-mid-sized practices).

You will be given what was found on the lead's LinkedIn profile and their firm's website. You return the personalised part only. The rest of each message is fixed and is added afterwards, so never write a greeting, a sign-off, or any of the pitch.

Return a JSON object with exactly four fields:
{
  "first": "<two short paragraphs, 35-45 words total>",
  "followup_1": "<one short line, max 20 words>",
  "followup_2": "<one short line, max 20 words>",
  "followup_3": "<one short line, max 20 words>"
}

THE FIRST MESSAGE
Paragraph 1 is a specific observation from their profile, in their own words where possible: something they actually posted about, their headline, their firm. Never "I came across your profile and was impressed."
Paragraph 2 is the bridge. Connect the observation to the pitch with shared logic so it reads as one thought rather than a compliment stapled to an ad. The usual bridge is that they are already doing the work to attract clients (events, posting, networking) and this makes that effort pay off faster. That sets up the line about not investing thousands in marketing, so it lands as recognition rather than a generic benefit.

Worked example, for a managing director who posts about start-up loans and attends FSB events:
"I saw your post about start-up loans, and your point about director guarantees hitting hardest. Between that and the FSB events, you're clearly putting real time into getting in front of London business owners.

That's usually who this works best for, so I thought it might be useful."

THE FOLLOW-UPS
One short line each, sitting above fixed text. Each must reference a DIFFERENT detail from the first message and from each other. Four messages that all mention the same post read as automated.
If there is only one usable detail about this person, return an empty string for the later follow-ups rather than repeating yourself. Empty is correct and expected; the fixed text stands on its own.

HARD RULES
Every fact must come from the material you were given. Nothing inferred, nothing invented. If you cannot find something specific, say something generic but true rather than making something up.
No em dashes anywhere. Use a full stop and a new sentence.
British English, short sentences, contractions fine.
Name the firm rather than saying "your practice".
Never criticise them or their business.
Post age matters as much as content. Someone whose newest post is years old is dormant, which is different from thin, and the two need different openings. Never write that someone is actively posting or attending events unless the material shows recent activity.
Professional bodies must be exactly right. ACCA members are Chartered Certified Accountants, never "chartered accountant", which is ICAEW. FCCA is a Fellow of ACCA and is Chartered Certified. MAAT and FMAAT are AAT and are NOT chartered at all. Copy whatever letters you are given; never expand them from memory, and never add letters that were not there.
Thin profiles are common. If there is genuinely nothing specific, return your best generic-but-true option and nothing more. A weak line that gets rejected is far better than a fabricated one that gets sent.
Output ONLY the JSON. No preamble, no markdown fences.$p$
where id = 1 and linkedin_dm_prompt is null;
