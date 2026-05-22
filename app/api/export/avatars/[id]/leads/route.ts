import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listProfiles } from "@/lib/avatars/leads-actions";
import type { Avatar, Lead } from "@/lib/types";

export const dynamic = "force-dynamic";

function csvEscape(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const STATIC_COLUMNS = [
  "name",
  "email",
  "company",
  "title",
  "linkedin_url",
  "phone",
  "lead_status",
  "email_status",
  "linkedin_stage",
  "call_status",
  "qualified",
  "unqualified_reason",
  "owner",
  "notes",
  "created_at",
] as const;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: avatarRow }, { data: leadRows }, profiles] = await Promise.all([
    supabase.from("avatars").select("name").eq("id", id).maybeSingle(),
    supabase
      .from("leads")
      .select("*")
      .eq("avatar_id", id)
      .order("created_at", { ascending: true }),
    listProfiles(),
  ]);

  if (!avatarRow) {
    return new NextResponse("Avatar not found", { status: 404 });
  }
  const avatar = avatarRow as Pick<Avatar, "name">;
  const leads = (leadRows ?? []) as Lead[];
  const profilesById = new Map(profiles.map((p) => [p.id, p]));

  const header = STATIC_COLUMNS.map((c) =>
    c
      .split("_")
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" "),
  );

  const rows = leads.map((l) => [
    l.name,
    l.email,
    l.company ?? "",
    l.title ?? "",
    l.linkedin_url ?? "",
    l.phone ?? "",
    l.lead_status,
    l.email_status,
    l.linkedin_stage,
    l.call_status,
    l.qualified,
    l.unqualified_reason ?? "",
    l.owner_id ? profilesById.get(l.owner_id)?.display_name ?? "" : "",
    l.notes ?? "",
    l.created_at,
  ]);

  const csv = [header, ...rows]
    .map((r) => r.map(csvEscape).join(","))
    .join("\n");

  const safeName = avatar.name.replace(/[^a-zA-Z0-9-_]+/g, "_");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="narada-${safeName}-leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
