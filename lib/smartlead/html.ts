/**
 * Smartlead stores email bodies as HTML (their editor is rich-text). When we
 * POST plain text with raw "\n" Smartlead renders the whole thing on one
 * line. These helpers convert between the plain text our Textarea edits and
 * the minimal HTML Smartlead expects.
 *
 * Round-trip is lossless for the formatting we expose (paragraphs + line
 * breaks). Merge tags ({{first_name}}, etc.) survive in both directions.
 */

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Plain text → Smartlead HTML. Blank lines become paragraph breaks; single
 * newlines become <br>. Merge tags pass through unchanged.
 */
export function plainToSmartleadHtml(plain: string): string {
  const normalised = plain.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const paragraphs = normalised.split(/\n{2,}/);
  return paragraphs
    .map((para) => {
      const escaped = escapeHtml(para);
      const withBreaks = escaped.replace(/\n/g, "<br />");
      return `<p>${withBreaks}</p>`;
    })
    .join("");
}

/**
 * Smartlead HTML → plain text. Reverses the above conversion well enough for
 * round-tripping through the editor. Strips any tags Smartlead's UI may have
 * added (bold, lists, etc.) so the user can re-type rather than fight HTML.
 */
export function smartleadHtmlToPlain(html: string): string {
  if (!html) return "";
  let s = html;
  // Normalise paragraph + break tags to newlines.
  s = s.replace(/<\s*br\s*\/?>/gi, "\n");
  s = s.replace(/<\/\s*p\s*>\s*<\s*p[^>]*>/gi, "\n\n");
  s = s.replace(/<\s*\/?p[^>]*>/gi, "");
  s = s.replace(/<\s*\/?div[^>]*>/gi, "\n");
  // Strip remaining tags.
  s = s.replace(/<[^>]+>/g, "");
  // Decode the entities we encoded on the way out (and a few extras that
  // Smartlead's editor sometimes emits).
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  // Collapse runs of 3+ blank lines and trim trailing whitespace.
  s = s.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+$/gm, "");
  return s.trim();
}
