/* =====================================================
   Fake data for the Narada prototype.
   Profiles, Avatars, Leads — mirroring lib/types.ts.
   ===================================================== */

const PROFILES = [
  { id: "u-isabel", display_name: "Isabel Reyes", hue: 285 },
  { id: "u-mateo",  display_name: "Mateo Kuipers", hue: 32 },
  { id: "u-priya",  display_name: "Priya Shah",    hue: 198 },
  { id: "u-aaron",  display_name: "Aaron Mensah",  hue: 142 },
  { id: "u-noor",   display_name: "Noor Hadid",    hue: 348 },
];

const CURRENT_USER = PROFILES[0];

const AVATARS = [
  {
    id: "a-cfo-50",
    name: "CFOs · Mid-market SaaS",
    created_at: "2026-03-12T10:00:00Z",
    source: "Apollo · 14 March",
    total_leads: 2_184,
    contacted: 1_412,
    replied: 218,
    won: 14,
    owner_split: [
      { display_name: "Isabel", count: 612, hue: 285 },
      { display_name: "Mateo",  count: 588, hue: 32 },
      { display_name: "Priya",  count: 498, hue: 198 },
      { display_name: "Aaron",  count: 486, hue: 142 },
    ],
    spark: [12, 18, 14, 22, 28, 24, 31, 36, 34, 42, 38, 47],
  },
  {
    id: "a-rev-eu",
    name: "RevOps Leaders · EU PE-backed",
    created_at: "2026-02-28T09:00:00Z",
    source: "Apollo · 1 March",
    total_leads: 1_318,
    contacted: 980,
    replied: 142,
    won: 9,
    owner_split: [
      { display_name: "Priya",  count: 460, hue: 198 },
      { display_name: "Mateo",  count: 432, hue: 32 },
      { display_name: "Noor",   count: 426, hue: 348 },
    ],
    spark: [22, 20, 26, 21, 28, 30, 28, 34, 31, 36, 33, 38],
  },
  {
    id: "a-vp-eng",
    name: "VP Engineering · Series B / C",
    created_at: "2026-04-02T11:00:00Z",
    source: "Apollo · 3 April",
    total_leads: 864,
    contacted: 312,
    replied: 47,
    won: 3,
    owner_split: [
      { display_name: "Aaron",  count: 318, hue: 142 },
      { display_name: "Isabel", count: 286, hue: 285 },
      { display_name: "Noor",   count: 260, hue: 348 },
    ],
    spark: [4, 6, 5, 8, 10, 12, 11, 14, 16, 13, 18, 22],
  },
  {
    id: "a-cmo-dtc",
    name: "CMOs · DTC ($25–100M)",
    created_at: "2026-01-18T08:00:00Z",
    source: "Apollo · 19 Jan",
    total_leads: 1_672,
    contacted: 1_550,
    replied: 184,
    won: 11,
    owner_split: [
      { display_name: "Isabel", count: 560, hue: 285 },
      { display_name: "Priya",  count: 558, hue: 198 },
      { display_name: "Mateo",  count: 554, hue: 32 },
    ],
    spark: [38, 36, 40, 42, 38, 44, 41, 46, 48, 44, 50, 47],
  },
  {
    id: "a-ops-mfg",
    name: "Plant Managers · Industrial 200+",
    created_at: "2026-04-22T14:00:00Z",
    source: "Apollo · 23 April",
    total_leads: 502,
    contacted: 88,
    replied: 9,
    won: 0,
    owner_split: [
      { display_name: "Noor",   count: 252, hue: 348 },
      { display_name: "Aaron",  count: 250, hue: 142 },
    ],
    spark: [2, 1, 3, 4, 2, 5, 4, 6, 5, 8, 7, 9],
  },
  {
    id: "a-coo-log",
    name: "COOs · Logistics & Freight",
    created_at: "2026-05-05T13:00:00Z",
    source: "Apollo · 6 May",
    total_leads: 318,
    contacted: 24,
    replied: 2,
    won: 0,
    owner_split: [
      { display_name: "Mateo",  count: 168, hue: 32 },
      { display_name: "Priya",  count: 150, hue: 198 },
    ],
    spark: [0, 0, 1, 2, 1, 3, 2, 4, 3, 4, 5, 6],
  },
];

// ─── Lead generator for the active avatar ─────────────────
const FIRST_NAMES = ["Elena","David","Sarah","James","Maya","Tom","Lina","Ravi","Anya","Owen","Greta","Faruk","Hugo","Yusuf","Maeve","Ines","Oscar","Mira","Niko","Aiyana","Theo","Lucia","Ben","Camille","Felix","Sora","Magnus","Adaeze","Cleo","Rohan"];
const LAST_NAMES = ["Vasquez","Brennan","Holst","Okafor","Linde","Schmid","Tanaka","Yablon","Petrov","Marchetti","Adesanya","Schiller","Romero","Bennett","Khoury","Lindqvist","Kowalski","Vega","Pham","Maxwell","Iwasaki","Costa","Vermeer","Halberg","Ng","Saito","Olsen","Aalto","Reinhart","Sumi"];
const COMPANIES = ["Anvil & Spool","Bramblerose","Calderwood Labs","Delvanto","Ellingsworth Group","Fernhill Bio","Greysky","Heimrun","Iverleaf","Jocasta Health","Kelvinor","Larkspur Tech","Mossbright","Nockford","Oxenmoor","Pinewell","Quintaglio","Risborough","Sandpiper","Tinderwick","Umbravale","Voltaire & Co.","Wexfield","Xanadu Freight","Yarrowmere","Zephyr Lab","Avilon","Blackmoor","Coldwater Labs","Driftworks","Earlswood","Foxglove HQ","Greatwood","Hollowbrook","Ironvale"];
const TITLES = ["CFO","VP Finance","Chief of Staff","Head of Strategy","Director, RevOps","VP Engineering","Head of Platform","CTO","CMO","VP Marketing","Director, Growth","COO","Head of Operations","Plant Director","VP Supply Chain"];
const CITIES = ["London","Amsterdam","Berlin","New York","Boston","Paris","Munich","Dublin","Madrid","Toronto","Austin","Singapore","Stockholm","Milan"];
const EMP_SIZES = ["51-200","201-500","501-1,000","1,001-5,000","5,001-10,000"];

function rng(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}
function pick(arr, r) { return arr[Math.floor(r() * arr.length)]; }

const EMAIL_STATUSES = ["none","none","smartlead_sent","smartlead_sent","smartlead_sent","replied","bounced"];
const LINKEDIN_STAGES = ["none","none","connection_sent","connection_sent","connection_accepted","first_message","first_followup","second_followup","third_followup","dead"];
const CALL_STATUSES = ["not_called","not_called","not_called","called","voicemail","reached"];
const LEAD_STATUSES = ["new","new","active","active","active","won","unqualified","dead"];

function generateLeads(avatarId, count) {
  const r = rng(avatarId.charCodeAt(2) * 1000 + count);
  const leads = [];
  const ownerIds = PROFILES.map((p) => p.id);
  for (let i = 0; i < count; i++) {
    const first = pick(FIRST_NAMES, r);
    const last = pick(LAST_NAMES, r);
    const company = pick(COMPANIES, r);
    const ownerId = r() < 0.08 ? null : ownerIds[Math.floor(r() * ownerIds.length)];
    const email_status = pick(EMAIL_STATUSES, r);
    const linkedin_stage = pick(LINKEDIN_STAGES, r);
    const call_status = pick(CALL_STATUSES, r);
    const lead_status = pick(LEAD_STATUSES, r);
    const daysAgo = Math.floor(r() * 60);
    const updated = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
    leads.push({
      id: `l-${avatarId}-${i}`,
      avatar_id: avatarId,
      owner_id: ownerId,
      name: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}@${company.toLowerCase().replace(/[^a-z]/g, "")}.com`,
      company,
      title: pick(TITLES, r),
      city: pick(CITIES, r),
      employees: pick(EMP_SIZES, r),
      linkedin_url: r() > 0.15 ? `https://linkedin.com/in/${first.toLowerCase()}-${last.toLowerCase()}` : null,
      phone: r() > 0.25 ? `+44 7${Math.floor(r() * 900000000 + 100000000)}` : null,
      website: r() > 0.05 ? `${company.toLowerCase().replace(/[^a-z]/g, "")}.com` : null,
      email_status,
      linkedin_stage,
      call_status,
      lead_status,
      qualified: lead_status === "unqualified" ? "unqualified" : "qualified",
      email_status_updated_at: email_status === "none" ? null : updated,
      linkedin_stage_updated_at: linkedin_stage === "none" ? null : updated,
      call_status_updated_at: call_status === "not_called" ? null : updated,
      lead_status_updated_at: updated,
      created_at: updated,
      notes: r() > 0.7 ? "Mentioned budget approval pending in Q3. Re-engage end of August." : null,
    });
  }
  return leads;
}

// Sample activity log for a single lead
const SAMPLE_ACTIVITY = [
  { who: "Isabel Reyes", action: "added a note", when: "2h ago" },
  { who: "Mateo Kuipers", action: "marked email as replied", when: "1d ago" },
  { who: "Isabel Reyes", action: "moved LinkedIn to 1st Follow-up", when: "3d ago" },
  { who: "System", action: "imported from Apollo", when: "12d ago" },
];

window.NARADA_DATA = {
  PROFILES,
  CURRENT_USER,
  AVATARS,
  generateLeads,
  SAMPLE_ACTIVITY,
};
