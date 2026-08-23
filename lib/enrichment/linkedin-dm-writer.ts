import "server-only";

import type { TokenUsage } from "@/lib/leads/linkedin-dm";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-opus-5";

export interface DmSource {
  name: string;
  title: string | null;
  company: string | null;
  /** Apollo fields, used when nothing has been scraped yet. */
  headline: string | null;
  industry: string | null;
  city: string | null;
  websiteSummary: string | null;
  linkedinSummary: string | null;
  postsSummary: string | null;
}

export interface DmResult {
  first: string;
  followup_1: string;
  followup_2: string;
  followup_3: string;
  /** 'thin' when there was almost nothing specific to work with. */
  quality: "good" | "thin";
  isAccountingFirm: boolean;
  /** Reported by the API, so the cost shown is measured rather than guessed. */
  usage: TokenUsage;
}

/** The fixed wording each opening is dropped into, straight from Settings. */
export interface DmTemplateSet {
  first: string;
  followup_1: string;
  followup_2: string;
  followup_3: string;
}

const SLOT_TITLES: Record<keyof DmTemplateSet, string> = {
  first: "FIRST MESSAGE",
  followup_1: "FOLLOW-UP 1 (sent when the first message got no reply)",
  followup_2: "FOLLOW-UP 2 (still no reply)",
  followup_3: "FOLLOW-UP 3 (final one, still no reply)",
};

/**
 * Show the model the actual message each line lands in.
 *
 * Without this it writes the follow-up lines blind — a standalone observation
 * that then collides with whatever fixed sentence follows it. Seeing the real
 * text is what lets it write a line that hands off into the next one.
 *
 * [NAME] is deliberately NOT substituted. The system prompt is cached across
 * every lead in a run, and caching only works while the text is byte-identical
 * — dropping each person's name in here would give every lead a different
 * prompt and quietly turn a ~70% saving into none at all. The greeting is
 * added later during assembly anyway, so the model never needs it.
 */
function renderTemplates(templates: DmTemplateSet): string {
  const blocks = (Object.keys(SLOT_TITLES) as (keyof DmTemplateSet)[])
    .map((slot) => {
      const raw = (templates[slot] ?? "").trim();
      if (!raw) return `=== ${SLOT_TITLES[slot]} ===\n(not in use — return "" for ${slot})`;
      const shown = raw
        .replace(/\[NAME\]/g, "<their first name>")
        .replace(/\[OPENING\]/g, `>>>>> YOUR "${slot}" TEXT GOES HERE <<<<<`);
      return `=== ${SLOT_TITLES[slot]} ===\n${shown}`;
    })
    .join("\n\n");

  return `THE FOUR MESSAGES YOU ARE WRITING INTO\n\n${blocks}`;
}

/**
 * The output contract lives in code, not in the editable prompt.
 *
 * Sahil can rewrite the writing rules freely without breaking parsing — if the
 * shape were part of that text, an innocent edit would take the whole batch
 * down.
 */
function buildContract(templates: DmTemplateSet): string {
  return `
${renderTemplates(templates)}

HOW YOUR LINES MUST FIT (fixed; overrides anything above about output format)

Read the fixed wording above before writing anything. Each line you write is
dropped in where marked and must run straight on into the sentence beneath it,
so the finished message reads as one person writing one message. A line that
could be deleted without the message changing is a failed line.

THE FOLLOW-UPS ARE FOLLOW-UPS, NOT NEW MESSAGES
Messages 2, 3 and 4 go to someone who read the previous one and did not reply.
Write them as somebody circling back, not as a fresh introduction:
  - never re-introduce yourself or the offer
  - never reuse a detail already used in an earlier message
  - do not open with a new standalone compliment or observation, because the
    fixed sentence that follows assumes an unanswered message, not an opener
  - a good follow-up line reads like the next sentence in a conversation the
    reader has been ignoring, and hands off naturally to the fixed text
Phrases that carry that continuity well: "Still think...", "Came back to
this because...", "For what it's worth...". Use your own words, not these.

Return an object with exactly these six fields:
  first        - the opening for the first message
  followup_1   - one short line, or "" if there is nothing further worth saying
  followup_2   - one short line, or ""
  followup_3   - one short line, or ""
  quality      - "good" if you found something genuinely specific about this
                 person, "thin" if you fell back on generic-but-true material
  is_accounting_firm - true if this person works at an accounting or
                 bookkeeping practice. false for anyone else: lettings agents,
                 finance brokers, insolvency practitioners, consultants,
                 software vendors, students, and anyone selling TO accountants
                 rather than working as one.

Write the personalised part only. Never write a greeting, a sign-off, or any
of the pitch: those are already in the fixed wording above.

An empty followup is correct and expected when the source material only
supports one good observation. The fixed text still reads properly on its own,
so silence is better than repeating yourself.`;
}

/** Guarantees valid JSON back, so a batch can't die on a stray markdown fence. */
const SCHEMA = {
  type: "object",
  properties: {
    first: { type: "string" },
    followup_1: { type: "string" },
    followup_2: { type: "string" },
    followup_3: { type: "string" },
    quality: { type: "string", enum: ["good", "thin"] },
    is_accounting_firm: { type: "boolean" },
  },
  required: [
    "first",
    "followup_1",
    "followup_2",
    "followup_3",
    "quality",
    "is_accounting_firm",
  ],
  additionalProperties: false,
} as const;

/**
 * Everything known about the lead, best material first.
 *
 * Scraped posts come before the static profile because that is where the
 * usable detail almost always is. Apollo fields are included as a floor so a
 * never-scraped lead still produces something true rather than nothing.
 */
export function buildSourceBlock(s: DmSource): string {
  const parts: string[] = [];

  parts.push(
    [
      `Name: ${s.name}`,
      s.title && `Job title: ${s.title}`,
      s.company && `Firm: ${s.company}`,
      s.headline && `LinkedIn headline: ${s.headline}`,
      s.industry && `Industry: ${s.industry}`,
      s.city && `Location: ${s.city}`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  if (s.postsSummary) parts.push(`── Their LinkedIn posts ──\n${s.postsSummary}`);
  else parts.push("── Their LinkedIn posts ──\nNot available.");

  if (s.linkedinSummary) parts.push(`── Their LinkedIn profile ──\n${s.linkedinSummary}`);
  if (s.websiteSummary) parts.push(`── Their firm's website ──\n${s.websiteSummary}`);

  if (!s.postsSummary && !s.linkedinSummary && !s.websiteSummary) {
    parts.push(
      "NOTE: nothing has been scraped for this lead. You only have the fields above. " +
        "Do not invent anything. Write the best generic-but-true opening you can from " +
        'the headline and firm name, and set quality to "thin".',
    );
  }

  return parts.join("\n\n");
}

/** True when the lead has nothing beyond the Apollo import. */
export function hasScrapedMaterial(s: DmSource): boolean {
  return Boolean(s.postsSummary || s.linkedinSummary || s.websiteSummary);
}

export async function writeLinkedInDm(
  source: DmSource,
  writingRules: string,
  templates: DmTemplateSet,
  apiKey: string,
): Promise<DmResult> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      // Cached as one block. It is the same ~5k tokens of rules, templates and
      // contract for every lead in a run, so paying full price per lead was
      // most of the bill. Cache reads cost a tenth.
      system: [
        {
          type: "text",
          text: `${writingRules.trim()}\n\n${buildContract(templates)}`,
          cache_control: { type: "ephemeral" },
        },
      ],
      // Medium keeps a batch of hundreds affordable without making the lines
      // noticeably worse; this is a writing task, not a reasoning one.
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: SCHEMA },
      },
      messages: [{ role: "user", content: buildSourceBlock(source) }],
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    // Surfaced verbatim on the lead so a dry account reads as "out of credit"
    // rather than a mystery failure.
    throw new Error(`Anthropic ${res.status}: ${body}`);
  }

  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
    stop_reason?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    };
  };

  const usage: TokenUsage = {
    input: data.usage?.input_tokens ?? 0,
    output: data.usage?.output_tokens ?? 0,
    cacheWrite: data.usage?.cache_creation_input_tokens ?? 0,
    cacheRead: data.usage?.cache_read_input_tokens ?? 0,
  };

  if (data.stop_reason === "refusal") {
    throw new Error("Claude declined to write for this lead");
  }

  const text = data.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
  if (!text) throw new Error("Anthropic returned no text content");

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Could not parse response as JSON: ${text.slice(0, 160)}`);
  }

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const first = str(parsed.first);
  if (!first) throw new Error("No opening returned for the first message");

  return {
    first,
    followup_1: str(parsed.followup_1),
    followup_2: str(parsed.followup_2),
    followup_3: str(parsed.followup_3),
    quality: parsed.quality === "thin" ? "thin" : "good",
    // Absent or malformed is treated as "looks fine" — a missing flag must
    // never quietly mark a real accountant as out of scope.
    isAccountingFirm: parsed.is_accounting_firm !== false,
    usage,
  };
}
