import "server-only";

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
}

/**
 * The output contract lives in code, not in the editable prompt.
 *
 * Sahil can rewrite the writing rules in Settings freely without breaking
 * parsing — if the shape were part of that text, an innocent edit would take
 * the whole batch down.
 */
const CONTRACT = `
OUTPUT CONTRACT (this section is fixed and overrides anything above about output format)

Return an object with exactly these six fields:
  first        - the two-paragraph opening for the first message
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
of the pitch: those are added afterwards.

An empty followup is correct and expected when the source material only
supports one good observation. Repeating the same detail across four messages
is worse than saying nothing.`;

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
      system: `${writingRules.trim()}\n\n${CONTRACT}`,
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
  };
}
