/**
 * Apollo CSV column -> friendly key mapping. Lookup is case-insensitive.
 *
 * The values on the right are the normalised keys we store and show in UI.
 * Anything not in this map is slug-cased and passed through as-is
 * (and still stored in raw_data). The four required canonical columns are:
 * name, email, company, linkedin_url.
 */
const APOLLO_FIELD_MAP_RAW: Record<string, string> = {
  // ─── Person identity ────────────────────────────────────────────────────
  "First Name": "first_name",
  "Last Name": "last_name",
  "Full Name": "name",
  "Person Name": "name",
  Headline: "headline",

  // ─── Person contact ─────────────────────────────────────────────────────
  Email: "email",
  "Primary Email": "email",
  "Email Status": "apollo_email_status",
  "Secondary Email": "secondary_email",
  "Personal Email": "personal_email",
  "Work Direct Phone": "phone",
  "Direct Phone": "phone",
  Phone: "phone",
  "Mobile Phone": "mobile_phone",
  Mobile: "mobile_phone",
  "Corporate Phone": "corporate_phone",
  "Home Phone": "home_phone",
  "Other Phone": "other_phone",

  // ─── Person role ────────────────────────────────────────────────────────
  Title: "title",
  Seniority: "seniority",
  Departments: "departments",
  Subdepartments: "subdepartments",
  Functions: "functions",
  "Is Likely To Engage": "is_likely_to_engage",

  // ─── Person LinkedIn (many Apollo variants) ─────────────────────────────
  "Person Linkedin Url": "linkedin_url",
  "Person LinkedIn URL": "linkedin_url",
  "Person Linkedin URL": "linkedin_url",
  "LinkedIn URL": "linkedin_url",
  "Linkedin URL": "linkedin_url",
  "Linkedin Url": "linkedin_url",
  "Linkedin Link": "linkedin_url",
  "LinkedIn Link": "linkedin_url",
  "LinkedIn Profile": "linkedin_url",

  // ─── Person location ────────────────────────────────────────────────────
  City: "city",
  "Lead City": "city",
  State: "state",
  "Lead State": "state",
  Country: "country",
  "Lead Country": "country",

  // ─── Company core ───────────────────────────────────────────────────────
  Company: "company",
  "Company Name": "company",
  "Company Name for Emails": "company",
  "Cleaned Company Name": "cleaned_company_name",
  Industry: "industry",
  "# Employees": "employees",
  Employees: "employees",
  "Employee Count": "employees",
  "Number of Retail Locations": "retail_locations",
  "Company Founded Year": "founded_year",

  // ─── Company links ──────────────────────────────────────────────────────
  Website: "website",
  "Company Website Full": "website",
  "Company Website Short": "company_website_short",
  "Company Blog Link": "company_blog_link",
  "Company Linkedin Url": "company_linkedin_url",
  "Company LinkedIn URL": "company_linkedin_url",
  "Company LinkedIn Link": "company_linkedin_url",
  "Company Twitter Link": "twitter_url",
  "Twitter Url": "twitter_url",
  "Company Facebook Link": "facebook_url",
  "Facebook Url": "facebook_url",

  // ─── Company address & phone ────────────────────────────────────────────
  "Company Street": "company_street",
  "Company City": "company_city",
  "Company State": "company_state",
  "Company Country": "company_country",
  "Company Postal Code": "company_postal_code",
  "Company Address": "company_address",
  "Company Phone": "company_phone",
  "Company Phone Number": "company_phone",

  // ─── Company financials ─────────────────────────────────────────────────
  "Annual Revenue": "annual_revenue",
  "Company Annual Revenue": "annual_revenue",
  "Company Market Cap": "company_market_cap",
  "Total Funding": "total_funding",
  "Company Total Funding": "total_funding",
  "Latest Funding": "latest_funding",
  "Company Latest Funding Type": "latest_funding",
  "Latest Funding Amount": "latest_funding_amount",
  "Company Latest Funding Amount": "latest_funding_amount",
  "Last Raised At": "last_raised_at",
  "Last Fund Raised At": "last_raised_at",

  // ─── Company descriptive ────────────────────────────────────────────────
  Keywords: "keywords",
  "Company Keywords": "keywords",
  "Company Technologies": "company_technologies",
  "Company Short Description": "company_short_description",
  "Company SEO Description": "company_seo_description",

  // ─── Apollo metadata ────────────────────────────────────────────────────
  Lists: "apollo_lists",
  Stage: "apollo_stage",
  "Lead Source": "apollo_lead_source",
  "Last Contacted": "apollo_last_contacted",
  "Account Owner": "apollo_account_owner",
};

/** Case-insensitive lookup table built once at module load. */
const APOLLO_FIELD_MAP_CI: Record<string, string> = Object.fromEntries(
  Object.entries(APOLLO_FIELD_MAP_RAW).map(([k, v]) => [k.toLowerCase(), v]),
);

export const APOLLO_FIELD_MAP = APOLLO_FIELD_MAP_RAW;

export const REQUIRED_VISIBLE_COLUMNS = ["name", "email", "company", "linkedin_url"] as const;

export const COLUMN_LABELS: Record<string, string> = {
  name: "Name",
  first_name: "First Name",
  last_name: "Last Name",
  headline: "Headline",
  email: "Email",
  secondary_email: "Secondary Email",
  personal_email: "Personal Email",
  phone: "Phone",
  mobile_phone: "Mobile Phone",
  corporate_phone: "Corporate Phone",
  company_phone: "Company Phone",
  title: "Title",
  seniority: "Seniority",
  departments: "Departments",
  subdepartments: "Subdepartments",
  functions: "Functions",
  company: "Company",
  cleaned_company_name: "Cleaned Company Name",
  industry: "Industry",
  employees: "Employees",
  retail_locations: "Retail Locations",
  founded_year: "Founded Year",
  annual_revenue: "Annual Revenue",
  total_funding: "Total Funding",
  latest_funding: "Latest Funding",
  latest_funding_amount: "Latest Funding Amount",
  last_raised_at: "Last Raised At",
  linkedin_url: "LinkedIn URL",
  website: "Website",
  company_website_short: "Website (short)",
  company_blog_link: "Blog",
  company_linkedin_url: "Company LinkedIn",
  twitter_url: "Twitter",
  facebook_url: "Facebook",
  city: "City",
  state: "State",
  country: "Country",
  company_city: "Company City",
  company_state: "Company State",
  company_country: "Company Country",
  company_address: "Company Address",
  company_street: "Company Street",
  company_postal_code: "Company Postal Code",
  keywords: "Keywords",
  company_technologies: "Technologies",
  company_short_description: "Company Description",
  company_seo_description: "SEO Description",
  is_likely_to_engage: "Likely to Engage",
};

/**
 * Convert a CSV header to our normalised key. Lookup is case-insensitive.
 * Unknown headers are slug-cased so they remain usable.
 */
export function normaliseHeader(header: string): string {
  const lower = header.trim().toLowerCase();
  const mapped = APOLLO_FIELD_MAP_CI[lower];
  if (mapped) return mapped;
  return lower.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function labelFor(key: string): string {
  if (COLUMN_LABELS[key]) return COLUMN_LABELS[key];
  return key
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Take a raw CSV row (header -> value) and produce a normalised row.
 * First non-empty value wins per key.
 */
export function normaliseRow(raw: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [header, value] of Object.entries(raw)) {
    const key = normaliseHeader(header);
    const v = (value ?? "").trim();
    if (!(key in out) || out[key] === "") out[key] = v;
  }
  if (!out.name && (out.first_name || out.last_name)) {
    out.name = `${out.first_name ?? ""} ${out.last_name ?? ""}`.trim();
  }
  return out;
}
