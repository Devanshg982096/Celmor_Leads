import type { Config } from "@netlify/functions";

/**
 * Scheduled Smartlead status sync: every 10 minutes, POST to
 * /api/smartlead/sync with the shared CRON_SECRET. The Next.js route does
 * the actual work (paginates each pushed-to campaign's leads, promotes
 * Narada's email_status to 'replied' or 'bounced' as appropriate).
 *
 * Same CRON_SECRET as enrich-tick. Same cron_enabled toggle pauses both.
 */
export default async () => {
  const site = process.env.URL ?? process.env.DEPLOY_URL;
  const secret = process.env.CRON_SECRET;
  if (!site) {
    console.error("[smartlead-sync] URL env not set");
    return new Response("URL env not set", { status: 500 });
  }
  if (!secret) {
    console.error("[smartlead-sync] CRON_SECRET env not set");
    return new Response("CRON_SECRET env not set", { status: 500 });
  }

  const res = await fetch(`${site}/api/smartlead/sync`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
  const body = await res.text();
  console.log(`[smartlead-sync] ${res.status} ${body.slice(0, 500)}`);
  return new Response(body, { status: res.status });
};

export const config: Config = {
  schedule: "*/10 * * * *",
};
