import { NextResponse } from "next/server";
import { listAvatarsWithStats } from "@/lib/avatars/actions";

export const dynamic = "force-dynamic";

function csvEscape(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  if (s.includes('"') || s.includes(",") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET() {
  const avatars = await listAvatarsWithStats();

  const header = [
    "Avatar",
    "Source",
    "Created at",
    "Total leads",
    "Contacted",
    "Replied",
    "Won",
    "Owners",
    "Owner split",
  ];

  const rows = avatars.map((a) => [
    a.name,
    a.source,
    a.created_at,
    a.total_leads,
    a.contacted,
    a.replied,
    a.won,
    a.owner_split.length,
    a.owner_split.map((s) => `${s.display_name}: ${s.count}`).join("; "),
  ]);

  const csv = [header, ...rows]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="narada-avatars-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
