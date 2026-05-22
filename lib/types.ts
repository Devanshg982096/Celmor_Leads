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
  created_at: string;
}

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

export interface AvatarWithStats extends AvatarRow {
  owner_split: { owner_id: string | null; display_name: string; count: number }[];
  contacted: number;
  replied: number;
  won: number;
  /** 12-week weekly activity counts from activity_log — newest week last. */
  weekly_activity: number[];
}
