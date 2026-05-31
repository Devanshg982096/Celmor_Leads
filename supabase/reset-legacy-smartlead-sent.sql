-- One-shot reset: revert email_status='smartlead_sent' for leads that were
-- marked sent via the legacy bulk action (no smartlead_campaign_id set).
-- Going forward, smartlead_sent is only written when a lead is actually
-- pushed to Smartlead via the planner or the direct push dialog, both of
-- which set smartlead_campaign_id.
--
-- Safe to run more than once.

update leads
   set email_status = 'none',
       email_status_updated_at = null
 where email_status = 'smartlead_sent'
   and smartlead_campaign_id is null;
