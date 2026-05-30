"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { WorkspaceSettings } from "@/lib/types";

export async function getWorkspaceSettings(): Promise<WorkspaceSettings | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    console.error("getWorkspaceSettings failed", error);
    return null;
  }
  return data;
}

type UpdatableKey =
  | "smartlead_api_key"
  | "anthropic_api_key"
  | "apify_token"
  | "icebreaker_prompt";

export async function setCronEnabled(
  enabled: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };

  const { error } = await supabase
    .from("workspace_settings")
    .update({ cron_enabled: enabled, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function updateWorkspaceSetting(
  key: UpdatableKey,
  value: string,
): Promise<{ error?: string; success?: true }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  // Treat empty strings as clearing the key (but never clear the prompt).
  const next = value.trim();
  if (key === "icebreaker_prompt" && next.length === 0) {
    return { error: "Icebreaker prompt can't be empty." };
  }

  const { error } = await supabase
    .from("workspace_settings")
    .update({
      [key]: key === "icebreaker_prompt" ? next : next.length === 0 ? null : next,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) return { error: error.message };

  revalidatePath("/settings");
  return { success: true };
}

type TestableKey = "smartlead_api_key" | "anthropic_api_key" | "apify_token";

interface TestResult {
  ok: boolean;
  detail: string;
}

/**
 * Hit each provider with the saved key. Surfaces the upstream response so
 * the user can tell whether the key in the database is the right one.
 */
export async function testWorkspaceKey(key: TestableKey): Promise<TestResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, detail: "Not authenticated." };

  const { data } = await supabase
    .from("workspace_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  const ws = data as WorkspaceSettings | null;
  const value = ws?.[key];
  if (!value) return { ok: false, detail: "No value saved." };

  try {
    if (key === "apify_token") {
      const res = await fetch(
        `https://api.apify.com/v2/users/me?token=${encodeURIComponent(value)}`,
        { signal: AbortSignal.timeout(15_000) },
      );
      if (!res.ok) {
        return { ok: false, detail: `Apify HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
      }
      const body = (await res.json()) as { data?: { username?: string; email?: string } };
      const who = body.data?.username ?? body.data?.email ?? "ok";
      return { ok: true, detail: `Apify recognized this token (${who}). Length: ${value.length} chars.` };
    }

    if (key === "anthropic_api_key") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": value,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 4,
          messages: [{ role: "user", content: "ping" }],
        }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) {
        return { ok: false, detail: `Anthropic HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
      }
      return { ok: true, detail: `Anthropic accepted this key. Length: ${value.length} chars.` };
    }

    // smartlead_api_key
    const res = await fetch(
      `https://server.smartlead.ai/api/v1/campaigns?api_key=${encodeURIComponent(value)}`,
      { signal: AbortSignal.timeout(15_000) },
    );
    if (!res.ok) {
      return { ok: false, detail: `Smartlead HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
    }
    const json = (await res.json()) as unknown;
    const count = Array.isArray(json) ? json.length : 0;
    return { ok: true, detail: `Smartlead accepted this key. ${count} campaign(s) visible.` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, detail: `Request failed: ${msg.slice(0, 200)}` };
  }
}
