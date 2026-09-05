import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { advanceConnectionQueue } from "@/lib/leads/connection-queue-worker";
export const dynamic = "force-dynamic";
export const maxDuration = 25;
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = createAdminClient();
  const { data, error } = await db.from("profile_import_queue").select("avatar_id")
    .in("status", ["queued", "processing"]).order("created_at").limit(1000);
  if (error) return NextResponse.json({ error: "Could not read queue" }, { status: 500 });
  const avatars = [...new Set((data ?? []).map(row => row.avatar_id))];
  // Independent avatars can advance together; each avatar still processes only one URL.
  const results = await Promise.allSettled(avatars.slice(0, 5).map(id => advanceConnectionQueue(db, id)));
  return NextResponse.json({ advanced: results.filter(result => result.status === "fulfilled").length });
}
