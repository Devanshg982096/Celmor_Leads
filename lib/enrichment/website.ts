import "server-only";

export const WEBSITE_ACTOR_ID = "apify~website-content-crawler";

interface ApifyWebsiteItem {
  url?: string;
  text?: string;
  markdown?: string;
  metadata?: { title?: string; description?: string };
}

/** Mirrors the n8n flow exactly: 5 pages, depth 2, playwright:adaptive, maxResults=1. */
export function buildWebsiteInput(url: string) {
  const target = url.startsWith("http") ? url : `https://${url}`;
  return {
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
}

/** Condense the dataset's first item into <=6k chars of markdown for the LLM. */
export function summariseWebsiteItems(items: ApifyWebsiteItem[]): string | null {
  if (!items.length) return null;
  const first = items[0];
  const composed = [
    first.metadata?.title && `# ${first.metadata.title}`,
    first.metadata?.description,
    first.markdown ?? first.text,
  ]
    .filter(Boolean)
    .join("\n\n")
    .trim();
  return composed.length === 0 ? null : composed.slice(0, 6000);
}

export type { ApifyWebsiteItem };
