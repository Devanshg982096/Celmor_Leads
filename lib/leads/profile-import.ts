export const PROFILE_FIELDS = [
  ["name", "Name"], ["email", "Email"], ["company", "Company"],
  ["title", "Job title"], ["phone", "Phone"], ["website", "Company website"],
  ["location", "Location"], ["industry", "Industry"],
  ["employees", "Company size"], ["headline", "Headline"],
] as const;
export type ProfileDraft = Record<typeof PROFILE_FIELDS[number][0], string>;

export function canonicalLinkedInUrl(value: string): string {
  const url = new URL(value.trim().replace(/^(www\.|linkedin\.com\/)/i, "https://$1"));
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.port ||
      !/^(?:[a-z]{2,3}\.)?linkedin\.com$/i.test(url.hostname)) {
    throw new Error("Paste a LinkedIn profile URL, such as https://www.linkedin.com/in/name.");
  }
  const match = url.pathname.match(/^\/in\/([^/]+)\/?$/i);
  if (!match || !/^[\p{L}\p{N}%_-]+$/u.test(match[1])) {
    throw new Error("Use a person's LinkedIn /in/ profile URL, not a company or search page.");
  }
  return `https://www.linkedin.com/in/${match[1].toLowerCase()}`;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 2000) :
    typeof value === "number" ? String(value) : "";
}

export function mapProfile(profile: Record<string, unknown>): ProfileDraft {
  if (profile.succeeded === false || profile.error) {
    throw new Error("Apify could not retrieve this profile. Check the URL or try again later.");
  }
  const email = text(profile.email);
  const draft: ProfileDraft = {
    name: text(profile.fullName) || [text(profile.firstName), text(profile.lastName)].filter(Boolean).join(" "),
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.toLowerCase() : "",
    company: text(profile.companyName), title: text(profile.jobTitle),
    phone: text(profile.mobileNumber) || text(profile.phoneNumber),
    website: text(profile.companyWebsite), location: text(profile.addressWithCountry) || text(profile.addressWithoutCountry),
    industry: text(profile.companyIndustry), employees: text(profile.companySize),
    headline: text(profile.headline),
  };
  if (!draft.name) throw new Error("Apify returned no usable profile. Check the URL and try again.");
  return draft;
}

export function validateDraft(input: ProfileDraft): ProfileDraft {
  const draft = Object.fromEntries(PROFILE_FIELDS.map(([key]) => [key, text(input[key])])) as ProfileDraft;
  if (!draft.name) throw new Error("Enter the lead's name.");
  if (draft.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) throw new Error("Enter a valid email or leave it blank.");
  draft.email = draft.email.toLowerCase();
  if (draft.website) {
    const url = new URL(/^https?:\/\//i.test(draft.website) ? draft.website : `https://${draft.website}`);
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) throw new Error("Enter a valid company website.");
    draft.website = url.toString();
  }
  return draft;
}
