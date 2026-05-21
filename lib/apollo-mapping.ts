/**
 * Apollo CSV column -> friendly key mapping.
 *
 * The keys on the left are the EXACT header strings Apollo exports.
 * The values on the right are normalised keys we use internally and show in UI.
 *
 * Anything not in this map is passed through as-is (and stored in raw_data).
 * The four required canonical columns are: name, email, company, linkedin_url.
 */
export const APOLLO_FIELD_MAP: Record<string, string> = {
  // Identity
  "First Name": "first_name",
  "Last Name": "last_name",
  "Full Name": "name",

  // Contact
  Email: "email",
  "Email Status": "apollo_email_status",
  "Primary Email": "email",
  "Secondary Email": "secondary_email",
  "Personal Email": "personal_email",
  "Work Direct Phone": "phone",
  "Mobile Phone": "mobile_phone",
  "Corporate Phone": "corporate_phone",
  "Home Phone": "home_phone",
  "Other Phone": "other_phone",

  // Role
  Title: "title",
  Seniority: "seniority",
  Departments: "departments",

  // Company
  Company: "company",
  "Company Name for Emails": "company",
  Industry: "industry",
  "# Employees": "employees",
  "Annual Revenue": "annual_revenue",
  "Total Funding": "total_funding",
  "Latest Funding": "latest_funding",
  "Latest Funding Amount": "latest_funding_amount",
  "Last Raised At": "last_raised_at",
  Keywords: "keywords",

  // Links
  "Person Linkedin Url": "linkedin_url",
  "Website": "website",
  "Company Linkedin Url": "company_linkedin_url",
  "Facebook Url": "facebook_url",
  "Twitter Url": "twitter_url",

  // Location
  City: "city",
  State: "state",
  Country: "country",
  "Company City": "company_city",
  "Company State": "company_state",
  "Company Country": "company_country",
  "Company Address": "company_address",
  "Company Phone": "company_phone",

  // Apollo metadata
  "Lists": "apollo_lists",
  "Stage": "apollo_stage",
  "Lead Source": "apollo_lead_source",
  "Last Contacted": "apollo_last_contacted",
  "Account Owner": "apollo_account_owner",
};

/**
 * Columns the user can never hide — always shown in the table.
 */
export const REQUIRED_VISIBLE_COLUMNS = ["name", "email", "company", "linkedin_url"] as const;

/**
 * Friendlier display labels for the canonical keys (used in UI).
 */
export const COLUMN_LABELS: Record<string, string> = {
  name: "Name",
  first_name: "First Name",
  last_name: "Last Name",
  email: "Email",
  secondary_email: "Secondary Email",
  personal_email: "Personal Email",
  phone: "Phone",
  mobile_phone: "Mobile Phone",
  corporate_phone: "Corporate Phone",
  title: "Title",
  seniority: "Seniority",
  departments: "Departments",
  company: "Company",
  industry: "Industry",
  employees: "# Employees",
  annual_revenue: "Annual Revenue",
  linkedin_url: "LinkedIn URL",
  website: "Website",
  company_linkedin_url: "Company LinkedIn",
  city: "City",
  state: "State",
  country: "Country",
  company_city: "Company City",
  company_state: "Company State",
  company_country: "Company Country",
  keywords: "Keywords",
};

/**
 * Convert an Apollo header (or any header) to our normalised key.
 * Unknown headers are slug-cased so they remain usable.
 */
export function normaliseHeader(header: string): string {
  if (APOLLO_FIELD_MAP[header]) return APOLLO_FIELD_MAP[header];
  return header
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Friendly label for any normalised key.
 */
export function labelFor(key: string): string {
  if (COLUMN_LABELS[key]) return COLUMN_LABELS[key];
  return key
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Take a raw CSV row (header -> value) and produce a normalised row.
 * Also computes a `name` if the source has First + Last but no Full Name.
 */
export function normaliseRow(raw: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [header, value] of Object.entries(raw)) {
    const key = normaliseHeader(header);
    if (!(key in out) || out[key] === "") out[key] = value ?? "";
  }
  if (!out.name && (out.first_name || out.last_name)) {
    out.name = `${out.first_name ?? ""} ${out.last_name ?? ""}`.trim();
  }
  return out;
}
