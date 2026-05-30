import type { Config } from "@netlify/functions";

/**
 * Scheduled trigger: every 3 minutes, POST to /api/enrich/tick on this site
 * with the shared CRON_SECRET bearer. The Next.js route does the actual work
 * (finalizes in-flight Apify runs and starts up to N new enrichments).
 *
 * We keep this function thin — just a trigger — so the enrichment logic
 * stays in one place under app/api/enrich/tick.
 */
export default async () => {
  const site = process.env.URL ?? process.env.DEPLOY_URL;
  const secret = process.env.CRON_SECRET;
  if (!site) {
    console.error("[enrich-tick] URL env not set");
    return new Response("URL env not set", { status: 500 });
  }
  if (!secret) {
    console.error("[enrich-tick] CRON_SECRET env not set");
    return new Response("CRON_SECRET env not set", { status: 500 });
  }

  const res = await fetch(`${site}/api/enrich/tick`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
  const body = await res.text();
  console.log(`[enrich-tick] ${res.status} ${body.slice(0, 500)}`);
  return new Response(body, { status: res.status });
};

export const config: Config = {
  schedule: "*/3 * * * *",
};
