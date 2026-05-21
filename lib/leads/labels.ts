import type {
  CallStatus,
  EmailStatus,
  LeadStatus,
  LinkedInStage,
  UnqualifiedReason,
} from "@/lib/types";

export const UNQUALIFIED_REASON_OPTIONS: { value: UnqualifiedReason; label: string }[] = [
  { value: "wrong_fit", label: "Wrong fit" },
  { value: "no_budget", label: "No budget" },
  { value: "not_decision_maker", label: "Not the decision-maker" },
  { value: "cant_reach", label: "Can't reach" },
  { value: "other", label: "Other" },
];

export function labelForReason(reason: UnqualifiedReason): string {
  return UNQUALIFIED_REASON_OPTIONS.find((r) => r.value === reason)?.label ?? reason;
}

export const EMAIL_STATUS_OPTIONS: { value: EmailStatus; label: string }[] = [
  { value: "none", label: "Not sent" },
  { value: "smartlead_sent", label: "Smartlead Sent" },
  { value: "replied", label: "Replied" },
  { value: "bounced", label: "Bounced" },
];

export const LINKEDIN_STAGE_OPTIONS: { value: LinkedInStage; label: string }[] = [
  { value: "none", label: "Not started" },
  { value: "connection_sent", label: "Connection Sent" },
  { value: "connection_accepted", label: "Connection Accepted" },
  { value: "first_message", label: "First Message" },
  { value: "first_followup", label: "First Follow-up" },
  { value: "second_followup", label: "Second Follow-up" },
  { value: "third_followup", label: "Third Follow-up" },
  { value: "dead", label: "Dead" },
];

export const CALL_STATUS_OPTIONS: { value: CallStatus; label: string }[] = [
  { value: "not_called", label: "Not called" },
  { value: "called", label: "Called" },
  { value: "voicemail", label: "Voicemail" },
  { value: "reached", label: "Reached" },
];

export const LEAD_STATUS_OPTIONS: { value: LeadStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "active", label: "Active" },
  { value: "unqualified", label: "Unqualified" },
  { value: "won", label: "Won" },
  { value: "dead", label: "Dead" },
];

export const LEAD_STATUS_BADGE: Record<
  LeadStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  new: "secondary",
  active: "default",
  unqualified: "outline",
  won: "default",
  dead: "destructive",
};

export const EMAIL_STATUS_BADGE: Record<
  EmailStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  none: "outline",
  smartlead_sent: "secondary",
  replied: "default",
  bounced: "destructive",
};

export const LINKEDIN_STAGE_BADGE: Record<
  LinkedInStage,
  "default" | "secondary" | "outline" | "destructive"
> = {
  none: "outline",
  connection_sent: "secondary",
  connection_accepted: "secondary",
  first_message: "default",
  first_followup: "default",
  second_followup: "default",
  third_followup: "default",
  dead: "destructive",
};

export const CALL_STATUS_BADGE: Record<
  CallStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  not_called: "outline",
  called: "secondary",
  voicemail: "secondary",
  reached: "default",
};

/**
 * Compact relative-time formatter: "4d ago", "2h ago", "just now".
 */
export function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  const yr = Math.floor(day / 365);
  return `${yr}y ago`;
}
