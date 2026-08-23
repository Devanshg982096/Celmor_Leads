import "server-only";

/**
 * harvestapi/linkedin-profile-posts — $0.002 per post, $0.001 for a profile
 * with none. Chosen over the alternatives on reliability: 2.9M runs in the
 * last 30 days with 11 failures, against a competitor charging 2.5x more with
 * 22,558 failures over the same period.
 *
 * Does NOT use the operator's LinkedIn cookies, so a block lands on the
 * scraping provider rather than on Sahil's own account.
 */
export const LINKEDIN_POSTS_ACTOR_ID = "harvestapi~linkedin-profile-posts";

/**
 * Ten is what a human reads before deciding what to write about. Fewer and you
 * miss the good detail — the usable line is often the fourth or fifth post
 * down, not the top one.
 */
const MAX_POSTS = 10;

/** Each post trimmed to roughly a paragraph; enough to know what it says. */
const MAX_POST_CHARS = 420;
const MAX_SUMMARY_CHARS = 6000;

export interface LinkedInPost {
  content?: string;
  linkedinUrl?: string;
  postedAt?: {
    date?: string;
    timestamp?: number;
    postedAgoText?: string;
  };
  engagement?: {
    likes?: number;
    comments?: number;
    shares?: number;
  };
  author?: {
    name?: string;
    linkedinUrl?: string;
  };
}

export function buildLinkedInPostsInput(url: string) {
  return {
    targetUrls: [url],
    maxPosts: MAX_POSTS,
    // Reposts are worth having: what someone chooses to amplify is a usable
    // signal, and summarisePostItems labels them so a reshare is never
    // described as something they wrote.
    includeReposts: true,
  };
}

/** The vanity path from a LinkedIn profile URL, for comparing author to target. */
function profileSlug(url: string | undefined): string | null {
  const m = /linkedin\.com\/in\/([^/?#]+)/i.exec(String(url ?? ""));
  return m ? decodeURIComponent(m[1]).toLowerCase().replace(/\/$/, "") : null;
}

/** Names compared loosely: case, accents, punctuation and post-nominals off. */
function normaliseName(name: string | undefined): string {
  return String(name ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    // Post-nominals appear on the profile but rarely on the post byline.
    .filter((w) => !["fcca", "acca", "aca", "maat", "fmaat", "mba", "bsc", "acma", "cgma", "mipa", "afa"].includes(w))
    .join(" ");
}

/**
 * Is this post the lead's own words, or something they reshared?
 *
 * Matched on URL first and name second. URL alone is not enough: LinkedIn
 * vanity addresses change, and the one in an Apollo export can be years out of
 * date, so a perfectly ordinary lead ends up with every one of their own posts
 * labelled as somebody else's. That happened, and the message that came out
 * ignored ten usable posts because it had been told none of them were his.
 *
 * Getting this wrong in the other direction is worse, so an unknown author is
 * only treated as the lead's own when there is nothing at all to compare.
 */
function isOwnPost(
  authorUrl: string | undefined,
  authorName: string | undefined,
  targetSlug: string | null,
  targetName: string,
): boolean {
  const authorSlug = profileSlug(authorUrl);
  if (targetSlug && authorSlug) {
    if (authorSlug === targetSlug) return true;
    // Fall through: a mismatch might just be a renamed profile.
  }
  const a = normaliseName(authorName);
  const t = normaliseName(targetName);
  if (a && t && a === t) return true;
  // Nothing identifying the author at all: assume the feed's owner.
  return !authorSlug && !a;
}

/** "3 months ago" from an ISO date, for when postedAgoText is missing. */
function ageFrom(date: string | undefined, now: number): string | null {
  if (!date) return null;
  const t = Date.parse(date);
  if (Number.isNaN(t)) return null;
  const days = Math.floor((now - t) / 86_400_000);
  if (days < 0) return "just now";
  if (days < 1) return "today";
  if (days < 14) return `${days} day${days === 1 ? "" : "s"} ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 730) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

/**
 * Turn scraped posts into the block of text Claude sees.
 *
 * Two things are deliberately made unmissable, because both produced wrong
 * messages when this was done by hand:
 *
 *  - HOW OLD the newest post is. A profile whose last post was four years ago
 *    is dormant, and writing "you're clearly active in the community" to that
 *    person is worse than saying nothing.
 *  - WHOSE post it is. Someone who only ever reshares a colleague's content
 *    hasn't said any of it, and quoting it back to them as their own view
 *    reads as a bot.
 *
 * `targetUrl` is the profile we asked for; anything authored by someone else
 * is a reshare.
 */
export function summariseLinkedInPosts(
  items: LinkedInPost[],
  targetUrl: string,
  targetName: string = "",
  now: number = Date.now(),
): string | null {
  if (!items.length) return null;

  const target = profileSlug(targetUrl);

  const rows = items
    .map((p) => {
      const text = (p.content ?? "").replace(/\s+/g, " ").trim();
      const isOwn = isOwnPost(p.author?.linkedinUrl, p.author?.name, target, targetName);
      const date = p.postedAt?.date;
      // The scraper appends visibility text to this, e.g. "2 weeks ago •
      // Visible to anyone on or off LinkedIn". Only the age is wanted.
      const agoText = p.postedAt?.postedAgoText?.split("•")[0].trim();
      const age = agoText || ageFrom(date, now);
      const ts = p.postedAt?.timestamp ?? (date ? Date.parse(date) : 0);
      return { text, isOwn, date, age, ts, author: p.author?.name };
    })
    .filter((r) => r.text.length > 0)
    .sort((a, b) => (b.ts || 0) - (a.ts || 0));

  if (!rows.length) return null;

  const own = rows.filter((r) => r.isOwn).length;
  const newest = rows[0];

  const header = [
    "POST ACTIVITY",
    newest.age
      ? `Newest post: ${newest.age}${newest.date ? ` (${newest.date.slice(0, 10)})` : ""}`
      : "Newest post: date unknown",
    `${rows.length} post${rows.length === 1 ? "" : "s"} found: ${own} written by them, ${rows.length - own} reshared from others`,
    own === 0
      ? "NOTE: none of these are their own words. Do not attribute any of it to them."
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  const body = rows
    .map((r) => {
      const when = r.age ?? r.date?.slice(0, 10) ?? "date unknown";
      const who = r.isOwn
        ? "THEIR OWN POST"
        : `RESHARED${r.author ? ` from ${r.author}` : ""}`;
      const text =
        r.text.length > MAX_POST_CHARS
          ? `${r.text.slice(0, MAX_POST_CHARS)}…`
          : r.text;
      return `- [${when}] ${who}: ${text}`;
    })
    .join("\n");

  return `${header}\n\n${body}`.slice(0, MAX_SUMMARY_CHARS);
}
