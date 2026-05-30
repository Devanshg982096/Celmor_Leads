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
 * Call Claude with the editable workspace prompt + lead context. Returns the
 * parsed {subject, icebreaker} JSON. Throws on transport, HTTP, or parse
 * failure so the caller can record the error on the lead row.
 */
export async function generateIcebreaker(
  input: IcebreakerInput,
  systemPrompt: string,
  apiKey: string,
): Promise<IcebreakerOutput> {
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
      system: systemPrompt,
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

  // Tolerate accidental ```json fences even though the prompt forbids them.
  const stripped = text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new Error(`Claude returned non-JSON: ${text.slice(0, 200)}`);
  }
  const obj = parsed as Partial<IcebreakerOutput>;
  if (typeof obj.subject !== "string" || typeof obj.icebreaker !== "string") {
    throw new Error("Claude JSON missing subject or icebreaker");
  }
  return { subject: obj.subject.trim(), icebreaker: obj.icebreaker.trim() };
}
