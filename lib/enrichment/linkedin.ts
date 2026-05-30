import "server-only";

export const LINKEDIN_ACTOR_ID = "dev_fusion~linkedin-profile-scraper";

interface LinkedInExperience {
  title?: string;
  companyName?: string;
  description?: string;
  caption?: string;
}

export interface LinkedInProfile {
  fullName?: string;
  headline?: string;
  about?: string;
  jobTitle?: string;
  companyName?: string;
  addressWithCountry?: string;
  experiences?: LinkedInExperience[];
  educations?: { title?: string; subtitle?: string }[];
}

export function buildLinkedInInput(url: string) {
  return { profileUrls: [url] };
}

export function summariseLinkedInItems(items: LinkedInProfile[]): string | null {
  if (!items.length) return null;
  const p = items[0];
  const parts: string[] = [];
  if (p.fullName) parts.push(`Name: ${p.fullName}`);
  if (p.headline) parts.push(`Headline: ${p.headline}`);
  if (p.jobTitle || p.companyName) {
    parts.push(`Current: ${[p.jobTitle, p.companyName].filter(Boolean).join(" at ")}`);
  }
  if (p.addressWithCountry) parts.push(`Location: ${p.addressWithCountry}`);
  if (p.about) parts.push(`About:\n${p.about}`);

  if (p.experiences?.length) {
    const top = p.experiences.slice(0, 4).map((e) => {
      const head = [e.title, e.companyName].filter(Boolean).join(" at ");
      const meta = [e.caption, e.description].filter(Boolean).join(" — ");
      return [head, meta].filter(Boolean).join("\n  ");
    });
    parts.push(`Experience:\n- ${top.join("\n- ")}`);
  }

  if (p.educations?.length) {
    const top = p.educations
      .slice(0, 2)
      .map((e) => [e.title, e.subtitle].filter(Boolean).join(" — "));
    parts.push(`Education:\n- ${top.join("\n- ")}`);
  }

  const composed = parts.join("\n\n").trim();
  return composed.length === 0 ? null : composed.slice(0, 5000);
}
