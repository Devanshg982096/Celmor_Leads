import "server-only";

const BASE = "https://server.smartlead.ai/api/v1";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SmartleadCampaign {
  id: number;
  name: string;
  status: string; // DRAFTED | ACTIVE | PAUSED | COMPLETED | STOPPED | ...
  created_at?: string;
  updated_at?: string;
}

export interface SmartleadSequenceStep {
  id?: number;
  seq_number: number;
  seq_delay_details?: { delay_in_days?: number };
  subject?: string;
  email_body?: string;
}

export interface SmartleadAnalytics {
  // Smartlead returns analytics with many fields; we use the ones we need
  // and pass the rest through as raw_data for future use.
  sent_count?: number;
  open_count?: number;
  reply_count?: number;
  bounce_count?: number;
  unique_sent_count?: number;
  total_lead_count?: number;
  raw_data?: Record<string, unknown>;
}

export interface SmartleadLead {
  first_name?: string;
  last_name?: string;
  email: string;
  company_name?: string;
  phone_number?: string;
  website?: string;
  location?: string;
  custom_fields?: Record<string, string>;
  linkedin_profile?: string;
}

export interface AddLeadsResult {
  upload_count?: number;
  total_leads?: number;
  already_added_to_campaign?: number;
  invalid_email_count?: number;
  error?: string;
  raw_response?: unknown;
}

// ─── Internals ──────────────────────────────────────────────────────────────

class SmartleadError extends Error {
  status: number;
  body: string;
  constructor(message: string, status: number, body: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(
  apiKey: string,
  path: string,
  init?: RequestInit & { query?: Record<string, string | number | undefined> },
): Promise<T> {
  const query = new URLSearchParams({ api_key: apiKey });
  if (init?.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v !== undefined) query.set(k, String(v));
    }
  }
  const url = `${BASE}${path}?${query.toString()}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new SmartleadError(
      `Smartlead ${res.status}: ${text.slice(0, 400)}`,
      res.status,
      text,
    );
  }
  return (text ? JSON.parse(text) : {}) as T;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function listCampaigns(apiKey: string): Promise<SmartleadCampaign[]> {
  const result = await request<unknown>(apiKey, "/campaigns/");
  // Smartlead sometimes returns { data: [...] }, sometimes a raw array.
  if (Array.isArray(result)) return result as SmartleadCampaign[];
  if (result && typeof result === "object" && "data" in result) {
    const data = (result as { data: unknown }).data;
    if (Array.isArray(data)) return data as SmartleadCampaign[];
  }
  return [];
}

export async function getCampaign(
  apiKey: string,
  campaignId: number,
): Promise<SmartleadCampaign | null> {
  try {
    const result = await request<SmartleadCampaign>(apiKey, `/campaigns/${campaignId}`);
    return result;
  } catch (e) {
    if (e instanceof SmartleadError && e.status === 404) return null;
    throw e;
  }
}

export async function getSequence(
  apiKey: string,
  campaignId: number,
): Promise<SmartleadSequenceStep[]> {
  const result = await request<unknown>(apiKey, `/campaigns/${campaignId}/sequences`);
  if (Array.isArray(result)) return result as SmartleadSequenceStep[];
  if (result && typeof result === "object" && "data" in result) {
    const data = (result as { data: unknown }).data;
    if (Array.isArray(data)) return data as SmartleadSequenceStep[];
  }
  return [];
}

export async function getAnalytics(
  apiKey: string,
  campaignId: number,
): Promise<SmartleadAnalytics> {
  // Smartlead exposes analytics at a couple of paths depending on plan/version.
  // We try the most common one and fall back to statistics.
  try {
    const result = await request<Record<string, unknown>>(
      apiKey,
      `/campaigns/${campaignId}/analytics`,
    );
    return normaliseAnalytics(result);
  } catch (e) {
    if (e instanceof SmartleadError && (e.status === 404 || e.status === 400)) {
      const fallback = await request<Record<string, unknown>>(
        apiKey,
        `/campaigns/${campaignId}/statistics`,
      ).catch(() => ({}) as Record<string, unknown>);
      return normaliseAnalytics(fallback);
    }
    throw e;
  }
}

function normaliseAnalytics(raw: Record<string, unknown>): SmartleadAnalytics {
  const num = (k: string) =>
    typeof raw[k] === "number" ? (raw[k] as number) : undefined;
  return {
    sent_count: num("sent_count") ?? num("total_sent_count") ?? num("sentCount"),
    open_count: num("open_count") ?? num("unique_open_count") ?? num("openCount"),
    reply_count: num("reply_count") ?? num("unique_reply_count") ?? num("replyCount"),
    bounce_count: num("bounce_count") ?? num("bounceCount"),
    unique_sent_count: num("unique_sent_count"),
    total_lead_count: num("total_lead_count") ?? num("total_leads"),
    raw_data: raw,
  };
}

interface AddLeadsBody {
  lead_list: SmartleadLead[];
  settings?: {
    ignore_global_block_list?: boolean;
    ignore_unsubscribe_list?: boolean;
    ignore_community_bounce_list?: boolean;
    ignore_duplicate_leads_in_other_campaign?: boolean;
  };
}

export async function addLeadsToCampaign(
  apiKey: string,
  campaignId: number,
  leads: SmartleadLead[],
): Promise<AddLeadsResult> {
  const body: AddLeadsBody = {
    lead_list: leads,
    settings: {
      // Don't re-add a lead Smartlead already has in another campaign — avoids
      // sending the same person two sequences by accident.
      ignore_duplicate_leads_in_other_campaign: true,
    },
  };
  const result = await request<Record<string, unknown>>(
    apiKey,
    `/campaigns/${campaignId}/leads`,
    { method: "POST", body: JSON.stringify(body) },
  );
  return {
    upload_count: typeof result.upload_count === "number" ? (result.upload_count as number) : undefined,
    total_leads: typeof result.total_leads === "number" ? (result.total_leads as number) : undefined,
    already_added_to_campaign:
      typeof result.already_added_to_campaign === "number"
        ? (result.already_added_to_campaign as number)
        : undefined,
    invalid_email_count:
      typeof result.invalid_email_count === "number"
        ? (result.invalid_email_count as number)
        : undefined,
    raw_response: result,
  };
}
