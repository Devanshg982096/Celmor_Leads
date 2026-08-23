import type { Lead, LinkedInDmSlot } from "@/lib/types";

/**
 * The fixed wording for all four messages, as saved in Settings. Passed down
 * from the server so assembly happens at display time — see the note on
 * Lead.linkedin_open_first for why we don't store finished messages.
 */
export interface DmTemplates {
  first: string;
  followup_1: string;
  followup_2: string;
  followup_3: string;
}

/**
 * How many leads are written simultaneously in one round.
 *
 * Lives here rather than beside the server actions because a "use server"
 * module may only export async functions — a plain constant in one is a build
 * error, not a type error.
 */
export const DM_BATCH_SIZE = 5;
export const DM_BATCH_OPTIONS = [2, 3, 5, 8, 10] as const;

/** How many leads one run covers before stopping. 0 means "all of them". */
export const DM_RUN_SIZE_OPTIONS = [10, 25, 50, 100, 0] as const;

export interface DmProgress {
  total: number;
  written: number;
  failed: number;
  remaining: number;
  /** Leads still needing their LinkedIn read before a message can be written. */
  needScrape: number;
  /** Leads whose scrapes are out at Apify right now. */
  scraping: number;
  /** Leads with material, waiting on a message. */
  readyToWrite: number;
}

/** Both bills, kept apart because they are two different accounts. */
export interface RunSpend {
  anthropic: TokenUsage;
  apifyUsd: number;
}

export const EMPTY_SPEND: RunSpend = {
  anthropic: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
  apifyUsd: 0,
};

/* ─────────────────────────────── cost ─────────────────────────────────── */

/**
 * Rates for claude-opus-5, in US dollars per million tokens.
 *
 * Hard-coded because the API does not report prices, only token counts. If
 * Anthropic changes their pricing this is the one place to correct, and the
 * displayed figure is an estimate from these numbers rather than a bill.
 */
export const MODEL_RATES = {
  input: 5,
  output: 25,
  /** Writing to the cache costs a premium; reading from it is a tenth. */
  cacheWrite: 6.25,
  cacheRead: 0.5,
} as const;

export interface TokenUsage {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

export const EMPTY_USAGE: TokenUsage = {
  input: 0,
  output: 0,
  cacheWrite: 0,
  cacheRead: 0,
};

export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    input: a.input + b.input,
    output: a.output + b.output,
    cacheWrite: a.cacheWrite + b.cacheWrite,
    cacheRead: a.cacheRead + b.cacheRead,
  };
}

/** Dollars for a given token count, from the rates above. */
export function costOf(u: TokenUsage): number {
  return (
    (u.input * MODEL_RATES.input +
      u.output * MODEL_RATES.output +
      u.cacheWrite * MODEL_RATES.cacheWrite +
      u.cacheRead * MODEL_RATES.cacheRead) /
    1_000_000
  );
}

/** Small amounts need more decimals than a price tag does. */
export function formatCost(usd: number): string {
  if (usd === 0) return "$0.00";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  if (usd < 1) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

export const DM_SLOTS: { slot: LinkedInDmSlot; label: string }[] = [
  { slot: "first", label: "First Message" },
  { slot: "followup_1", label: "Follow-up 1" },
  { slot: "followup_2", label: "Follow-up 2" },
  { slot: "followup_3", label: "Follow-up 3" },
];

const OPENING_FIELD: Record<LinkedInDmSlot, keyof Lead> = {
  first: "linkedin_open_first",
  followup_1: "linkedin_open_followup_1",
  followup_2: "linkedin_open_followup_2",
  followup_3: "linkedin_open_followup_3",
};

/** First word of the lead's name, for the greeting. */
export function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] ?? "";
}

/**
 * Fill a template. [NAME] and [OPENING] are the only substitutions.
 *
 * When the opening is empty the [OPENING] line is removed entirely rather than
 * left as a blank gap — an empty opening is a deliberate signal that the fixed
 * text should stand alone, so the message must still read cleanly.
 */
export function fillTemplate(
  template: string,
  name: string,
  opening: string,
): string {
  const body = opening.trim();
  let out = template.replace(/\[NAME\]/g, firstName(name));

  if (body.length === 0) {
    // Drop the placeholder and collapse the blank lines it leaves behind.
    out = out.replace(/\n*[ \t]*\[OPENING\][ \t]*\n*/g, "\n\n");
  } else {
    out = out.replace(/\[OPENING\]/g, body);
  }

  return out.replace(/\n{3,}/g, "\n\n").trim();
}

export type DmState =
  | { kind: "ready"; text: string; opening: string }
  /** Generated, but this slot was deliberately left as fixed text only. */
  | { kind: "fixed-only"; text: string }
  /** No fixed wording saved in Settings for this slot — nothing to send. */
  | { kind: "no-template" }
  | { kind: "not-generated" }
  | { kind: "failed"; error: string };

/**
 * What to show in one message column for one lead.
 */
export function dmFor(
  lead: Lead,
  templates: DmTemplates,
  slot: LinkedInDmSlot,
): DmState {
  const template = (templates[slot] ?? "").trim();
  if (template.length === 0) return { kind: "no-template" };

  const opening = lead[OPENING_FIELD[slot]] as string | null;

  if (opening === null) {
    if (lead.linkedin_dm_status === "failed") {
      return { kind: "failed", error: lead.linkedin_dm_error ?? "Generation failed" };
    }
    return { kind: "not-generated" };
  }

  const text = fillTemplate(template, lead.name, opening);
  return opening.trim().length === 0
    ? { kind: "fixed-only", text }
    : { kind: "ready", text, opening };
}

/** One-line summary for the collapsed column cell. */
export function previewLine(state: DmState): string {
  switch (state.kind) {
    case "ready":
      return state.opening.replace(/\s+/g, " ").trim();
    case "fixed-only":
      return "Fixed text only";
    case "no-template":
      return "No wording set";
    case "not-generated":
      return "—";
    case "failed":
      return "Failed";
  }
}
