import "server-only";

const APIFY_WEBSITE_ACTOR =
  "apify~website-content-crawler/run-sync-get-dataset-items";

interface ApifyWebsiteItem {
  url?: string;
  text?: string;
  markdown?: string;
  metadata?: { title?: string; description?: string };
}

/**
 * Crawl the lead's website with Apify and return a short markdown summary
 * suitable to feed an LLM. Returns null if no URL or the crawl yields nothing.
 *
 * Mirrors the n8n flow: 5 pages, depth 2, playwright:adaptive, maxResults=1.
 */
export async function scrapeWebsite(
  url: string | null | undefined,
  apifyToken: string,
): Promise<string | null> {
  if (!url) return null;
  const target = url.startsWith("http") ? url : `https://${url}`;

  const endpoint = `https://api.apify.com/v2/acts/${APIFY_WEBSITE_ACTOR}?token=${encodeURIComponent(apifyToken)}`;
  const body = {
    startUrls: [{ url: target }],
    maxCrawlPages: 5,
    maxCrawlDepth: 2,
    crawlerType: "playwright:adaptive",
    proxyConfiguration: { useApifyProxy: true },
    saveMarkdown: true,
    saveHtml: false,
    maxResults: 1,
    requestTimeoutSecs: 30,
    readableTextCharThreshold: 100,
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) {
    throw new Error(`Apify website crawler failed: ${res.status} ${await res.text()}`);
  }
  const items = (await res.json()) as ApifyWebsiteItem[];
  if (!items.length) return null;

  const first = items[0];
  const title = first.metadata?.title ?? "";
  const description = first.metadata?.description ?? "";
  const body_text = first.markdown ?? first.text ?? "";

  const composed = [
    title && `# ${title}`,
    description && description,
    body_text,
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();

  // Cap at ~6k chars so we don't blow the LLM context with one page.
  return composed.slice(0, 6000);
}
