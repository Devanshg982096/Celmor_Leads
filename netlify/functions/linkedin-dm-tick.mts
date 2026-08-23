import type { Config } from "@netlify/functions";

/**
 * Keeps a LinkedIn DM run going once the browser tab has gone away.
 *
 * This is NOT the old enrichment timer, which was removed. That one ran
 * constantly whether or not anyone had asked for anything, at one lead every
 * two minutes. This only does work while a campaign is explicitly marked as
 * running, and stops itself the moment that run finishes or is stopped.
 *
 * Thin on purpose: the actual work lives in app/api/linkedin-dm/tick so there
 * is one implementation shared with the browser's own loop.
 */
export default async () => {
  const site = process.env.URL ?? process.env.DEPLOY_URL;
  const secret = process.env.CRON_SECRET;
  if (!site) {
    console.error("[linkedin-dm-tick] URL env not set");
    return new Response("URL env not set", { status: 500 });
  }
  if (!secret) {
    console.error("[linkedin-dm-tick] CRON_SECRET env not set");
    return new Response("CRON_SECRET env not set", { status: 500 });
  }

  const res = await fetch(`${site}/api/linkedin-dm/tick`, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
  const body = await res.text();
  console.log(`[linkedin-dm-tick] ${res.status} ${body.slice(0, 500)}`);
  return new Response(body, { status: res.status });
};

export const config: Config = {
  schedule: "* * * * *",
};
