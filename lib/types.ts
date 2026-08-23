export type EmailStatus = "none" | "smartlead_sent" | "replied" | "bounced";
export type LinkedInStage =
  | "none"
  | "connection_sent"
  | "connection_accepted"
  | "first_message"
  | "first_followup"
  | "second_followup"
  | "third_followup"
  | "dead";
export type CallStatus = "not_called" | "called" | "voicemail" | "reached";
export type LeadStatus = "new" | "active" | "unqualified" | "won" | "dead";
export type QualifiedStatus = "qualified" | "unqualified";
export type UnqualifiedReason =
  | "wrong_fit"
  | "no_budget"
  | "not_decision_maker"
  | "cant_reach"
  | "other";
export type EnrichmentStatus = "pending" | "enriching" | "done" | "failed";

// ─── Row shapes (canonical) ───────────────────────────────────────────────
export interface ProfileRow {
  id: string;
  display_name: string;
  email: string;
  created_at: string;
}

export interface AvatarRow {
  id: string;
  name: string;
  created_at: string;
  created_by: string;
  source: string;
  visible_columns: string[];
  total_leads: number;
}

export interface LeadRow {
  id: string;
  avatar_id: string;
  owner_id: string | null;
  name: string;
  email: string;
  company: string | null;
  title: string | null;
  linkedin_url: string | null;
  phone: string | null;
  raw_data: Record<string, unknown>;
  email_status: EmailStatus;
  linkedin_stage: LinkedInStage;
  call_status: CallStatus;
  lead_status: LeadStatus;
  linkedin_stage_updated_at: string | null;
  email_status_updated_at: string | null;
  call_status_updated_at: string | null;
  lead_status_updated_at: string | null;
  notes: string | null;
  qualified: QualifiedStatus;
  unqualified_reason: UnqualifiedReason | null;
  unqualified_at: string | null;
  unqualified_by: string | null;
  website_summary: string | null;
  linkedin_summary: string | null;
  subject_line: string | null;
  icebreaker: string | null;
  enriched_at: string | null;
  enrichment_status: EnrichmentStatus | null;
  enrichment_error: string | null;
  smartlead_campaign_id: string | null;
  smartlead_lead_id: string | null;
  website_run_id: string | null;
  linkedin_run_id: string | null;
  /** Recent posts with dates and own-vs-reshared labelling. */
  linkedin_posts_summary: string | null;
  linkedin_posts_run_id: string | null;
  enrichment_started_at: string | null;
  enrichment_attempts: number;
  campaign_plan_id: string | null;
  /**
   * LinkedIn DM openings, written by Claude. These are the personalised part
   * only — the fixed wording is applied at display time from
   * workspace_settings, so changing the template updates every lead for free.
   *
   * null  = not generated yet
   * ""    = generated, but there was nothing further worth saying; the fixed
   *         text should stand alone rather than repeat an earlier message
   */
  linkedin_open_first: string | null;
  linkedin_open_followup_1: string | null;
  linkedin_open_followup_2: string | null;
  linkedin_open_followup_3: string | null;
  linkedin_dm_generated_at: string | null;
  linkedin_dm_status: LinkedInDmStatus | null;
  linkedin_dm_error: string | null;
  /** Raised while writing: worth a look before sending. */
  linkedin_dm_flag: LinkedInDmFlag | null;
  created_at: string;
}

export type LinkedInDmStatus = "pending" | "generating" | "done" | "failed";

/** 'thin' = little to work with. 'not_accounting' = probably out of niche. */
export type LinkedInDmFlag = "thin" | "not_accounting";

/** The four LinkedIn messages, in send order. */
export type LinkedInDmSlot = "first" | "followup_1" | "followup_2" | "followup_3";

export type CampaignPlanStatus =
  | "draft"
  | "enriching"
  | "ready"
  | "pushed"
  | "done";

export interface CampaignPlanRow {
  id: string;
  avatar_id: string;
  name: string;
  target_lead_count: number;
  smartlead_campaign_id: string | null;
  status: CampaignPlanStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceSettingsRow {
  id: number;
  smartlead_api_key: string | null;
  anthropic_api_key: string | null;
  apify_token: string | null;
  icebreaker_prompt: string;
  /** Rules Claude follows when writing the four LinkedIn openings. */
  linkedin_dm_prompt: string | null;
  /** Fixed first message. [NAME] and [OPENING] are substituted in. */
  linkedin_dm_template: string | null;
  linkedin_followup_1: string | null;
  linkedin_followup_2: string | null;
  linkedin_followup_3: string | null;
  cron_enabled: boolean;
  updated_at: string;
}

/** The five editable LinkedIn DM fields, as saved from Settings. */
export type LinkedInDmField =
  | "linkedin_dm_prompt"
  | "linkedin_dm_template"
  | "linkedin_followup_1"
  | "linkedin_followup_2"
  | "linkedin_followup_3";

export interface ActivityLogRow {
  id: string;
  lead_id: string;
  user_id: string;
  action: string;
  created_at: string;
}

// ─── Supabase Database shape ──────────────────────────────────────────────
type Insertable<T, Optional extends keyof T> = Omit<T, Optional> & Partial<Pick<T, Optional>>;

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Insertable<ProfileRow, "created_at">;
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      avatars: {
        Row: AvatarRow;
        Insert: Insertable<AvatarRow, "id" | "created_at" | "total_leads">;
        Update: Partial<AvatarRow>;
        Relationships: [];
      };
      leads: {
        Row: LeadRow;
        Insert: Insertable<LeadRow, "id" | "created_at">;
        Update: Partial<LeadRow>;
        Relationships: [
          {
            foreignKeyName: "leads_avatar_id_fkey";
            columns: ["avatar_id"];
            referencedRelation: "avatars";
            referencedColumns: ["id"];
          },
        ];
      };
      activity_log: {
        Row: ActivityLogRow;
        Insert: Insertable<ActivityLogRow, "id" | "created_at">;
        Update: Partial<ActivityLogRow>;
        Relationships: [];
      };
      workspace_settings: {
        Row: WorkspaceSettingsRow;
        Insert: Insertable<WorkspaceSettingsRow, "id" | "updated_at" | "icebreaker_prompt">;
        Update: Partial<WorkspaceSettingsRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      email_status: EmailStatus;
      linkedin_stage: LinkedInStage;
      call_status: CallStatus;
      lead_status: LeadStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}

// Public aliases
export type Profile = ProfileRow;
export type Avatar = AvatarRow;
export type Lead = LeadRow;
export type ActivityLog = ActivityLogRow;
export type WorkspaceSettings = WorkspaceSettingsRow;
export type CampaignPlan = CampaignPlanRow;

export interface AvatarWithStats extends AvatarRow {
  owner_split: { owner_id: string | null; display_name: string; count: number }[];
  contacted: number;
  replied: number;
  won: number;
  /** 12-week weekly activity counts from activity_log — newest week last. */
  weekly_activity: number[];
}
