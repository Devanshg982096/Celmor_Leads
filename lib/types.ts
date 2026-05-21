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

export interface Database {
  public: {
    Tables: {
      avatars: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          created_by: string;
          source: string;
          visible_columns: string[];
          total_leads: number;
        };
        Insert: Omit<Database["public"]["Tables"]["avatars"]["Row"], "id" | "created_at" | "total_leads"> & {
          id?: string;
          created_at?: string;
          total_leads?: number;
        };
        Update: Partial<Database["public"]["Tables"]["avatars"]["Insert"]>;
      };
      leads: {
        Row: {
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
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["leads"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["leads"]["Insert"]>;
      };
      activity_log: {
        Row: {
          id: string;
          lead_id: string;
          user_id: string;
          action: string;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["activity_log"]["Row"], "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["activity_log"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

export type Avatar = Database["public"]["Tables"]["avatars"]["Row"];
export type Lead = Database["public"]["Tables"]["leads"]["Row"];
export type ActivityLog = Database["public"]["Tables"]["activity_log"]["Row"];
