import type { Lead } from "@/lib/types";

/**
 * Canonical columns that live as real fields on the leads table.
 * Everything else lives in raw_data JSON.
 */
const CANONICAL_LEAD_FIELDS = new Set([
  "name",
  "email",
  "company",
  "title",
  "linkedin_url",
  "phone",
]);

/**
 * Resolve the display value for a column key on a lead.
 * Looks at the canonical field first, then falls back to raw_data.
 */
export function getLeadValue(lead: Lead, key: string): string {
  if (CANONICAL_LEAD_FIELDS.has(key)) {
    const value = (lead as unknown as Record<string, unknown>)[key];
    return typeof value === "string" ? value : value == null ? "" : String(value);
  }
  const raw = lead.raw_data?.[key];
  return typeof raw === "string" ? raw : raw == null ? "" : String(raw);
}
