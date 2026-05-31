import "server-only";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

export interface IcebreakerInput {
  name: string;
  title: string | null;
  company: string | null;
  websiteSummary: string | null;
  linkedinSummary: string | null;
}

export interface IcebreakerOutput {
  subject: string;
  icebreaker: string;
}

/**
 * Substitute the common {{placeholders}} a prompt author might use to inline
 * the lead context directly in the system prompt. Anything left unmatched is
 * preserved untouched so existing prompts keep working.
 */
function applyTemplate(prompt: string, input: IcebreakerInput): string {
  const map: Record<string, string> = {
    "{{name}}": input.name,
    "{{first_name}}": input.name.split(/\s+/)[0] ?? input.name,
    "{{title}}": input.title ?? "",
    "{{company}}": input.company ?? "",
    "{{company_name}}": input.company ?? "",
    "{{website_summary}}": input.websiteSummary ?? "(not available)",
    "{{linkedin_summary}}": input.linkedinSummary ?? "(not available)",
  };
  let out = prompt;
  for (const [token, value] of Object.entries(map)) {
    out = out.split(token).join(value);
  }
  return out;
}

/**
 * Call Claude with the editable workspace prompt + lead context.
 *
 * Accepts either output shape:
 *   - JSON `{subject, icebreaker}` (the original format) — both stored
 *   - Plain text (icebreaker only) — stored as icebreaker, subject empty
 *
 * The sentinel `[INSUFFICIENT DATA]` short-circuits to a friendly error
 * so the lead row records *why* it failed instead of writing a useless
 * placeholder as the icebreaker.
 */
export async function generateIcebreaker(
  input: IcebreakerInput,
  systemPrompt: string,
  apiKey: string,
): Promise<IcebreakerOutput> {
  const renderedSystem = applyTemplate(systemPrompt, input);

  const userContent = [
    `Lead name: ${input.name}`,
    input.title && `Title: ${input.title}`,
    input.company && `Company: ${input.company}`,
    "",
    "── Website summary ──",
    input.websiteSummary ?? "(not available)",
    "",
    "── LinkedIn summary ──",
    input.linkedinSummary ?? "(not available)",
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 600,
      system: renderedSystem,
      messages: [{ role: "user", content: userContent }],
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    content?: { type: string; text?: string }[];
  };
  const text = data.content?.find((c) => c.type === "text")?.text?.trim() ?? "";
  if (!text) throw new Error("Anthropic returned no text content");

  // Caller is telling us the source material is too thin — surface as a
  // proper error so we don't store junk on the lead.
  if (text.includes("[INSUFFICIENT DATA]")) {
    throw new Error("Claude reported insufficient source material for this lead");
  }

  // First try the JSON shape (back-compat with the original prompt).
  const stripped = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  if (stripped.startsWith("{") && stripped.endsWith("}")) {
    try {
      const obj = JSON.parse(stripped) as Partial<IcebreakerOutput>;
      if (typeof obj.subject === "string" && typeof obj.icebreaker === "string") {
        return { subject: obj.subject.trim(), icebreaker: obj.icebreaker.trim() };
      }
    } catch {
      // fall through to plain-text handling
    }
  }

  // Plain-text fallback: treat the whole reply as the icebreaker. Subject
  // is left empty so the Smartlead template / sequence editor controls it.
  const icebreaker = stripped
    .replace(/^["'`]+|["'`]+$/g, "") // strip wrapping quotes if Claude added any
    .trim();
  return { subject: "", icebreaker };
}
