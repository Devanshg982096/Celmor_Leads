import type { Config } from "@netlify/functions";

const handler = async () => {
  const site = process.env.URL ?? process.env.DEPLOY_URL;
  const secret = process.env.CRON_SECRET;
  if (!site || !secret) return new Response("Queue scheduler is not configured", { status: 500 });
  const response = await fetch(`${site}/api/profile-queue/tick`, { method: "POST", headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(26000) });
  return new Response(await response.text(), { status: response.status });
};

export default handler;
export const config: Config = { schedule: "* * * * *" };
