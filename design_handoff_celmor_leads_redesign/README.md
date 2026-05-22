# Handoff — Narada / Celmor Leads UI Redesign

## Overview

A modern, polished, premium redesign of the existing **Narada / Celmor Leads** Next.js app. The redesign covers every existing screen (Avatars index, Avatar drill-in, LinkedIn view, Emails view, Calls view, Lead detail drawer) and introduces **one new screen**: a **Channels hub** that lives between the Avatars index and the channel drill-in views.

The redesign is **dark-mode-first** and stays close to the existing token system (indigo accent on near-black), but raises the visual quality with a stronger type hierarchy (Questrial for display, Geist for UI), tabular numerics throughout, richer KPI cards with sparklines and inline deltas, refined status pills with dot indicators, and the new Channels hub as a deliberate "landing moment" after picking an avatar.

The HTML prototype also contains a second exploratory direction called **Pivot** (Kanban for leads, Sankey-style LinkedIn flow, priority dialer cards). It is bundled for reference only — **the primary direction to ship is Refined**.

## About the Design Files

The files in this bundle are **design references created in HTML/React (via Babel in-browser)** — a prototype showing intended look and behavior, not production code to copy directly.

The task is to **recreate these HTML designs in the existing codebase** — `Celmor_Leads-master/`, a Next.js 15 App Router + Tailwind v4 + shadcn/ui + Supabase project — using its established patterns and libraries:

- App Router pages live in `app/`
- shadcn primitives live in `components/ui/`
- Domain components live in `components/avatars/`, `components/channels/`, `components/leads/`, `components/layout/`
- Design tokens are CSS variables in `app/globals.css`
- Server actions live in `lib/avatars/`, `lib/leads/`
- Database row shapes are in `lib/types.ts`

**Where the existing token system already covers a value, use the existing CSS variable** (e.g. `var(--accent-primary)`, `var(--bg-elevated)`). Only introduce new tokens where the redesign genuinely calls for them (see "New tokens" below).

## Fidelity

**High-fidelity (hifi)** — pixel-level mockup with final colors, typography, spacing, micro-interactions, and copy. Recreate pixel-perfectly using the existing shadcn + Tailwind setup. Replace any inline styles in the prototype with Tailwind classes or token-driven CSS that matches the project's conventions.

## Direction to ship: REFINED

Both directions ("Refined" and "Pivot") are exposed in the prototype via a top-right segmented switch and the Tweaks panel. **Ship the Refined direction.** Pivot is exploratory/divergent reference material only — useful for inspiration on future iterations (Kanban view as a Master table mode, Sankey funnel as an alternate LinkedIn visualization).

---

## Screens / Views

### 1. Avatars index (`/`)
**Existing file to redesign:** `app/page.tsx` + `components/avatars/AvatarCard.tsx`

**Purpose:** Browse all imported target-persona Avatars; jump into one.

**Layout:** Page header (left: H1 "Avatars" + subtitle; right: Export ghost button + "New avatar" primary button). Then a responsive CSS grid of Avatar cards: `repeat(auto-fill, minmax(320px, 1fr))`, 14px gap.

**AvatarCard redesign (Refined):**
- `background: var(--bg-elevated)`, `border: 1px solid var(--border-subtle)`, `border-radius: 8px`, padding 18px
- Hover: `border-color: var(--border-default)`, `background: var(--bg-elevated-2)`, `transform: translateY(-1px)`
- Layout (flex column, gap 14px):
  1. **Head row:** H3 title (16px, weight 600) + small "N owners" neutral badge on the right; below the title, a meta line "{source} · {formatted date}" in 11.5px tertiary
  2. **Numbers row:** big total leads (`font-family: Questrial; 36px; tabular-nums; -0.02em letter-spacing; line-height: 1`) with "Total leads" caption beneath, and a **right-aligned 12-week sparkline** (92×34px, filled at 0.15 opacity, 1.5px stroke, end-dot)
  3. **Metrics row:** three columns — Contacted / Replied / Won, each with a small uppercase tertiary key (11px, 0.06em letter-spacing) and a mono tabular value. Replied also shows the reply rate in success green inline
  4. **Owner split:** a 3px stacked progress bar (segments tinted from each owner's deterministic HSL hue), with a wrap-able legend below — `name · count` per owner
- Click anywhere on card → navigates to the **Channels hub** for that avatar (NOT directly to Master).

**Subtle touches in the redesign:**
- Cards use a 1px border + soft 8px radius and only animate on hover (no static shadow).
- The total-leads number is the visual anchor; everything else recedes.
- The sparkline gives each avatar a sense of momentum at a glance.

---

### 2. Channels hub  ← **NEW SCREEN**
**Suggested route:** `/avatars/[id]` (replace the current Master page) OR `/avatars/[id]/overview` if you want to keep `/avatars/[id]` as Master.
**Suggested new file:** `app/avatars/[id]/page.tsx` (becomes the hub) — move the current Master view to `app/avatars/[id]/master/page.tsx` (which is already a path used in the codebase).

**Purpose:** A deliberate landing page after picking an avatar — gives a "where are we across the four channels" picture before drilling in. Solves the problem that today, clicking an avatar drops the user straight into a giant Leads table.

**Layout:**

1. **Hub hero** (full-width, 8px top / 32px bottom padding, bottom border 1px subtle):
   - Left: small uppercase kicker "Avatar overview" (11px, accent-soft color, with a thin `var(--accent-primary)` 1×18px hairline before it); below: H1 in **Questrial 42px**, line-height 1.05, letter-spacing -0.02em; below: meta line "{N} leads · {source} · {date}" in 14px secondary
   - Right: three large stats in a horizontal row separated by 1px subtle vertical dividers (28px padding between). Each stat: small uppercase label + big Questrial 32px tabular-nums value. Values are Contacted (default color), Replied (accent-soft), Won (status-success)

2. **Section meta row** (between hero and tiles, mb 16px):
   - Left: small uppercase tertiary label "Four channels · pick your surface"
   - Right: ghost "Add leads" + secondary "Export" buttons

3. **Channels grid** — 2-column CSS grid, 16px gap, four tiles:

#### Channel tile (shared shell)
- `background: var(--bg-elevated)`, `border: 1px solid var(--border-subtle)`, `border-radius: 12px`, padding `28px 28px 24px`, **min-height 320px**, flex column
- Each tile has a unique color theme (see below) applied via CSS custom properties on the tile root: `--tile-glow`, `--tile-border`, `--tile-icon-bg`, `--tile-icon-fg`, `--tile-accent`
- Hover state: `transform: translateY(-2px)`, `border-color: var(--tile-border)`, `box-shadow` (medium); a radial glow `background: radial-gradient(circle at 100% 0%, var(--tile-glow) 0%, transparent 55%)` fades in over 280ms
- Cursor pointer, click → navigates to the channel's drill-in page

**Tile structure** (top to bottom):
- **Head:** icon (36×36, 10px radius, `--tile-icon-bg` background, `--tile-icon-fg` color, 18px lucide icon centered) + name (12px uppercase tertiary, 0.1em letter-spacing) + title (Questrial 22px) — and on the right, a small "kicker" stat (mono number + small label below it)
- **Hero (flex 1, vertically centered):** **big number in Questrial 64px**, tabular-nums, -0.03em letter-spacing, line-height 0.95; below: secondary 13px subtitle
- **Mid-tile visualization** (channel-specific — see below)
- **Foot** (`padding-top: 18px; border-top: 1px solid var(--border-subtle)`): two small stats on the left (10.5px uppercase label + 14px mono value) and an "Open {Channel} →" link on the right in `--tile-accent` color (the arrow icon nudges right on hover via `gap` transition)

#### Tile 1 — Master (indigo theme)
- Theme: `--tile-icon-bg: rgba(99, 102, 241, 0.14)`, `--tile-icon-fg: #A5B4FC`, `--tile-accent: #A5B4FC`, `--tile-border: #6366F1`, `--tile-glow: rgba(99, 102, 241, 0.08)`
- Icon: `layers`
- Title: "All leads, one surface"
- Kicker: total imported lead count
- Big number: active lead count, subtitle "leads actively in motion"
- **Visualization:** horizontal stacked status-distribution bar (6px tall, 3px radius, segments in 5 colors for new/active/won/unqualified/dead), with a wrap-able legend below — each entry a 7×7×2px swatch + label + mono count
- Foot stats: Won count (success green) + number of distinct owners
- Click → Master leads table

#### Tile 2 — LinkedIn (blue theme)
- Theme: `--tile-icon-bg: rgba(96, 165, 250, 0.14)`, `--tile-icon-fg: #93C5FD`, `--tile-accent: #93C5FD`, `--tile-border: #60A5FA`, `--tile-glow: rgba(96, 165, 250, 0.08)`
- Icon: `linkedin`
- Title: "Connection journey"
- Kicker: reachable lead count (have a LinkedIn URL)
- Big number: acceptance rate as `{N}<small>%</small>` (the `%` is 36px / 0.6 opacity), subtitle "connection acceptance rate"
- **Visualization:** a 4-row mini funnel. Each row: 10px uppercase label (`Sent / Accepted / Messaged / Replied`, 86px width) + horizontal bar (10px tall, 2px radius, linear-gradient `#60A5FA → #93C5FD`) whose width is `(value / max) * 180px` + mono count
- Foot stats: Reply rate (blue) + In-motion count
- Click → LinkedIn channel page

#### Tile 3 — Emails (emerald theme)
- Theme: `--tile-icon-bg: rgba(52, 211, 153, 0.14)`, `--tile-icon-fg: #6EE7B7`, `--tile-accent: #6EE7B7`, `--tile-border: #34D399`, `--tile-glow: rgba(52, 211, 153, 0.06)`
- Icon: `mail`
- Title: "14-day send & reply pulse"
- Kicker: emailable count
- Big number: reply rate as `{N}%`, subtitle "{replied} of {sent}"
- **Visualization:** a 14-bar mini histogram (height 56px, flex row, 3px gap). Each column is a flex-column-reverse stack of three segments (sent in `rgba(52,211,153,0.18)`, replied in `#34D399`, bounced in `var(--status-danger)`), scaled so the tallest day fills the 50px usable height. Days with no activity show a single 2px subtle line. Axis labels below: "14d ago" ← → "today"
- Foot stats: Sent total + Bounced (red)
- Click → Emails channel page

#### Tile 4 — Calls (amber theme)
- Theme: `--tile-icon-bg: rgba(251, 191, 36, 0.14)`, `--tile-icon-fg: #FCD34D`, `--tile-accent: #FCD34D`, `--tile-border: #FBBF24`, `--tile-glow: rgba(251, 191, 36, 0.06)`
- Icon: `phone`
- Title: "Today's priority queue"
- Kicker: dialable lead count
- Big number: pending in queue, subtitle "leads in queue · {N}% reach rate"
- **Visualization:** a stacked list of three priority queue rows. Each row: small amber `#1 / #2 / #3` badge + lead name (flex 1, ellipsis) + company name in tertiary. Row styling: `background: var(--bg-elevated-2)`, `border: 1px solid var(--border-subtle)`, 6px radius, 7px/10px padding, 6px row gap
- Priority scoring (used to pick top 3): `email_status === "replied" → +10`; `linkedin_stage === "connection_accepted" → +5`; LinkedIn followup stages → `+7`
- Foot stats: Reached (green) + "Best window" (e.g. 10–11am)
- Click → Calls channel page

---

### 3. Master leads table  (`/avatars/[id]/master`)
**Existing file to redesign:** `components/avatars/LeadsTable.tsx`

Stays as a TanStack table but with refined chrome:

- **Tab bar at the top:** segmented control wrapping `Channels / Master / LinkedIn / Emails / Calls`, each with a small lucide icon. Background `var(--bg-overlay)`, 1px subtle border, 6px radius, 3px inner padding. Active tab: `var(--bg-elevated)` background, 1px subtle shadow. Hosted as `components/avatars/ChannelTabs.tsx` (new shared component used on Master/LinkedIn/Emails/Calls pages).

- **KPI strip** above the table — 5 cards in a `repeat(auto-fit, minmax(180px, 1fr))` grid, **joined by 1px borders inside a wrapping border** (so they look like one panel divided): `gap: 1px`, outer border 1px subtle, 8px radius, `overflow: hidden`, each card has `background: var(--bg-elevated)` so the 1px gaps reveal the parent border. Inside each card:
  - 11px uppercase tertiary label
  - **Questrial 28px tabular-nums** value
  - Hint row: optional delta pill (3px radius, success/danger/neutral colored backgrounds, mono 11px) + tertiary text
  - Optional small sparkline absolutely positioned bottom-right (64×20, no fill, 0.6 opacity)

- **Bulk action bar** appears above the table when leads are selected: `var(--bg-elevated-2)` background, accent border, glowing 4px outer shadow `0 0 0 4px var(--accent-subtle)`, accent-colored count

- **Table toolbar** (above the rows): search input (30px tall, var(--bg-overlay), with leading magnifier icon) + chip-row of filters + "{N} leads" mono on the right

- **Table itself:**
  - Width 100%, font-size 13px
  - Headers: 11px uppercase tertiary, 0.06em letter-spacing, 10px/14px padding, sticky top
  - Rows: `height: var(--row-h)` (40px cozy / 32px compact / 52px comfy via Tweaks density), `border-bottom: 1px subtle`, hover `var(--bg-elevated-2)`, cursor pointer (opens drawer)
  - Status cells use the new compact **dot-led badge** style (see "Status badges" below)
  - Name column: bold name + faint "· {title}" suffix in tertiary
  - Owner cell: 20×20 colored initials avatar + first name, 12.5px

---

### 4. LinkedIn view  (`/avatars/[id]/linkedin`)
**Existing file to redesign:** `components/channels/LinkedInView.tsx` + `LinkedInFunnel.tsx`

- Tab bar (as above)
- 4-card KPI strip (Reachable / Sent / Acceptance rate / Reply rate)
- **Replace the existing boxes-and-arrows funnel** with a new **chevron ribbon**:
  - `background: var(--bg-elevated)`, 1px subtle border, 8px radius, 16/18px padding
  - Head row: small uppercase tertiary title "Funnel · stage progression" + right-aligned tertiary text "Drop-off shown beneath each step"
  - 7-column grid (gap 4px), each step is `var(--bg-overlay)` background, 12/14px padding (with extra 8px on left for the chevron clip), `clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%)` (first step doesn't have the left notch; last step doesn't have the right point). Min height 56px.
  - Inside each step: 10.5px uppercase tertiary label, mono 18px value, and a mono 10.5px "−{N}%" drop indicator
  - Active step: `var(--accent-subtle)` background, label in accent-soft
  - Dead step: `rgba(248, 113, 113, 0.08)` background
- Chip-row filter (All stages / Not started / Sent / Accepted / Messaged) — active chip uses accent
- Table with 7 columns: Name · Company · Employees · LinkedIn (link button) · Stage (status badge) · Days since (mono tertiary) · Owner

---

### 5. Emails view  (`/avatars/[id]/emails`)
**Existing file to redesign:** `components/channels/EmailsView.tsx`

- Tab bar
- 4-card KPI strip (Emailable / Sent / Reply rate / Bounce rate) — KPIs include inline deltas like "+2pp" and "−0.4pp"
- Chip-row filter (Status: all / Not sent / Sent / Replied / Bounced) — each chip shows a small mono count badge inside
- Table with checkbox column + Name / Company / Email (link) / Status / Last touch (mono tertiary, e.g. "3d") / Owner

---

### 6. Calls view  (`/avatars/[id]/calls`)
**Existing file to redesign:** `components/channels/CallsView.tsx`

- Tab bar
- 5-card KPI strip (Dialable / Dialed / Reached rate / Voicemail rate / Pending)
- Table with Name · Company · Phone (mono link) · Status · Notes (clamped to one line, max-width 280px) · Owner

---

### 7. Lead detail drawer
**Existing file to redesign:** `components/leads/LeadDetailDrawer.tsx`

Replaces the shadcn `Sheet`-driven version. Slides in from the right.

- Overlay: `rgba(0, 0, 0, 0.6)` + `backdrop-filter: blur(4px)`, fade 200ms
- Drawer: 480px wide (max 96vw), `transform: translateX(100%)` → `translateX(0)` over 280ms cubic-bezier(0.2, 0.8, 0.2, 1), `box-shadow: 0 16px 48px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.35)`, `border-left: 1px solid var(--border-default)`, `background: var(--bg-elevated)`
- **Head section** (22/24px padding, 1px subtle bottom border):
  - Top row: H2 in **Questrial 22px** (lead name) + small "× close" ghost icon button (closes on click or Escape key); below the H2: secondary 13px "{title} · {company}"
  - Below: a row of status badges (lead / email / linkedin / call) — using the new badge style
- **Body** (20/24px padding, scrollable, gap 22px between sections). Each section has a small uppercase tertiary heading (10.5px, 0.08em letter-spacing, font-weight 600):
  - **Channels** — three secondary buttons (Send email / Open LinkedIn / Call {phone}) with leading icons
  - **Contact** — a stack of `kv-row`s: 90px label column (tertiary 12px) + value column. Email, Phone, LinkedIn, Company, Title, Employees, City, Owner. Empty values render "—" in tertiary
  - **Notes** — `var(--bg-overlay)` textarea, 90px min-height, 1px subtle border, 6px radius; focus border = accent. Save button right-aligned
  - **Activity** — list of rows with a left dot indicator + `<who> <action>` + mono `when` underneath; dashed bottom border between rows

---

### 8. App shell (sidebar + topbar)
**Existing files to redesign:** `components/layout/Sidebar.tsx` + `components/layout/TopBar.tsx` + `AppShell.tsx`

- **Sidebar (240px / 60px collapsed):** `var(--bg-base)` background, 1px subtle right border. Logo at top (Narada concentric-arcs mark + "narada" wordmark in Questrial 18px). Avatars list — each item 7/10px padding, 6px radius, hover/active state with a 2px accent indicator strip on the left edge and a 6px round dot (tertiary when inactive, accent with `box-shadow: 0 0 8px var(--accent-glow)` when active). New-avatar link with plus icon. Bottom: settings link + current-user row (26px initials avatar with deterministic HSL hue from user id + name)
- **Topbar (52px tall, sticky):** `background: rgba(10, 10, 11, 0.85)`, `backdrop-filter: blur(12px)`, 1px subtle bottom border, 24px horizontal padding. Left: clickable breadcrumb (`Avatars / {Avatar} / {Channel}` — both `Avatars` and `{Avatar}` are click-back links). Right: `⌘K`-style search trigger pill (the trigger only — actual command palette is out of scope for this redesign).

---

## Interactions & Behavior

- **Click avatar card** → `/avatars/[id]` (Channels hub).
- **Click any channel tile** → `/avatars/[id]/{channel}` (drill-in).
- **Click breadcrumb avatar name** → returns to Channels hub.
- **Click any row in any table** → opens Lead detail drawer.
- **Escape key** → closes drawer.
- **Hover on table rows** → background switches to `var(--bg-elevated-2)`.
- **Hover on channel tiles** → 2px lift + colored border + radial corner glow fade-in (280ms).
- **Bulk action bar** → only renders when `selected.size > 0`.
- **Drawer overlay click** → closes drawer.
- **All transitions** use `cubic-bezier(0.2, 0.8, 0.2, 1)` ease-out with 180ms duration (default) or 280ms for larger movements (drawer, tile hover).
- **Direction switch** in the topbar is **prototype-only** — do NOT ship this in production. It exists only so the user can A/B between Refined and Pivot during review.
- **Tweaks panel** is also prototype-only.

## State Management

The redesign is **not changing state shape** — keep all existing server actions, Supabase queries, and types. Only the rendering changes.

- Continue using the existing optimistic-patch pattern in `LeadsTable.tsx` / `LinkedInView.tsx` / `EmailsView.tsx` / `CallsView.tsx` for inline cell edits.
- The new Channels hub needs no new mutations — it only reads existing `LeadRow` data and computes aggregates client-side (same logic as `lib/avatars/channel-stats.ts` already does for the channel views).
- The hub's aggregates (active count, status distribution, LinkedIn funnel rates, email reply rate, call priority list) should ideally be derived in a server component from a single `listLeadsForAvatar(avatarId)` query so we don't re-fetch in the children.

## Design Tokens

The existing `app/globals.css` already declares most of what's needed. Below are values used in the redesign — **prefer existing tokens where they match, and only add new ones where noted**.

### Existing tokens to keep using
```
--bg-base: #0A0A0B
--bg-elevated: #131316     (mapped from #141416 — adjusted very slightly darker for richer dark mode)
--bg-overlay: #1C1C20      (was #1C1C1F — adjust if you want full alignment)
--border-subtle: #1F1F23   (was #26262A — slightly tighter)
--border-default: #2A2A2F  (was #2E2E33)
--text-primary: #F5F5F7
--text-secondary: #A1A1A8  (was #9CA3AF)
--text-tertiary: #6B6B72   (was #6B7280)
--accent-primary: #6366F1
--accent-hover: #818CF8
--accent-soft: #A5B4FC
--accent-subtle: rgba(99,102,241, 0.14)   (was 0.12 — slightly bolder hover affordance)

--status-success: #34D399  (was #10B981 — softer in dark mode)
--status-warning: #FBBF24  (was #F59E0B)
--status-danger:  #F87171  (was #EF4444)
--status-info:    #60A5FA
```

### New tokens to add
```
--bg-elevated-2: #18181C       /* one step above bg-elevated, for hover surfaces */
--bg-hover:      #1F1F24       /* table row hover, button secondary hover */
--border-strong: #36363C       /* used in chips, kbar trigger hover */
--text-quaternary: #4A4A50     /* very faint text (e.g. dim dots) */
--accent-glow:   rgba(99,102,241, 0.28)   /* used in focus glows and active indicator */
--accent-ink:    #0B0B1A       /* used as foreground on solid accent fills if needed */

--status-success-bg: rgba(52,211,153, 0.12)
--status-warning-bg: rgba(251,191,36, 0.12)
--status-danger-bg:  rgba(248,113,113, 0.12)
--status-info-bg:    rgba(96,165,250, 0.12)
--status-neutral:    #71717A
--status-neutral-bg: rgba(113,113,122, 0.14)

--shadow-sm: 0 1px 2px rgba(0,0,0,0.4)
--shadow-md: 0 4px 16px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)
--shadow-lg: 0 16px 48px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.35)

--ease-out: cubic-bezier(0.2, 0.8, 0.2, 1)
--dur: 180ms
```

### Type scale
- Display (Questrial): 18 / 22 / 28 / 30 / 32 / 36 / 42 / 54 / 64 px, line-height 0.95–1.1, letter-spacing -0.01em to -0.03em
- UI (Geist): 11 / 11.5 / 12 / 12.5 / 13 / 13.5 / 14 / 15 / 16 px, line-height 1.45
- Mono (Geist Mono): 10 / 10.5 / 11 / 11.5 / 12 / 13 / 14 px — `font-variant-numeric: tabular-nums`

The existing `font-family: var(--font-display)` already maps to Questrial in `globals.css` — keep that mapping. Geist Mono is already configured.

### Spacing scale
Use Tailwind's default 4px scale. Common gaps in the prototype: 8 / 12 / 14 / 16 / 18 / 22 / 24 / 28 / 32 px.

### Radii
- 4px (small chips), 6px (buttons, input, badges-square), 8px (cards, KPI panel), 12px (channel tiles, drawer corners — but drawer is straight-edge), 16px (special Pivot tiles), 999px (pills + badges)

### Status badge styling (refined)
Compact pill: 22px tall, 8px horizontal padding, 6px gap, 999px radius, 11.5px text, weight 500.
- A 6×6 round colored dot indicator on the left
- `success` variant: `background: rgba(52,211,153, 0.12); color: #34D399`
- `warning`, `danger`, `info`, `neutral`, `accent` variants follow the same pattern
- `outline` variant has no background, 1px `var(--border-default)` border, tertiary text
- Small `.sm` variant: 18px tall, 6px padding, 10.5px text, 5×5 dot

Map the existing `LinkedinStage` / `EmailStatus` / `CallStatus` / `LeadStatus` enum values to these variants — see `lib/leads/labels.ts` for the existing mapping (the redesign tightens it but doesn't change the structure).

## Assets

- **Logo:** keep the existing `components/brand/NaradaLogo.tsx` concentric-arcs mark — the redesign uses it unchanged at "md" size in the sidebar.
- **Icons:** `lucide-react` (already in the codebase) — use these icons throughout:
  - `Layers` (Master), `Linkedin` (LinkedIn), `Mail` (Emails), `Phone` (Calls)
  - `Grid` for the Channels hub tab
  - `Plus`, `Settings`, `PanelLeftClose`, `Search`, `Filter`, `Download`, `Upload`, `ArrowRight`, `ArrowUpRight`, `Sparkles`, `X`, `ChevronRight`, `ChevronDown`, `MoreHorizontal`
- **Fonts:** Geist + Geist Mono + Questrial — all three are already loaded via `next/font` in the existing project.

## Files in this bundle

```
design_handoff_celmor_leads_redesign/
  README.md                              ← this file
  prototype/
    Narada Leads Redesign.html           ← prototype entry point
    styles.css                           ← all CSS used in the prototype
    app.jsx                              ← shell + routing + tweaks wiring
    components.jsx                       ← shared primitives (icons, badges, sparkline, drawer)
    data.jsx                             ← fake data (profiles, avatars, lead generator)
    screens-refined.jsx                  ← Refined direction screens + Channels hub
    screens-pivot.jsx                    ← Pivot direction screens (reference only)
    tweaks-panel.jsx                     ← tweaks panel infra (prototype-only)
```

Open `Narada Leads Redesign.html` in any browser to interact with the prototype. The Refined direction is selected by default. Click the indigo dot next to any avatar in the sidebar (or any avatar card on the home screen) to land on the Channels hub.

## Suggested implementation order

1. **Tokens first** — extend `app/globals.css` with the new tokens listed above.
2. **Shared primitives** — refresh `components/ui/badge.tsx` to support the new dot-led pill variants, add a new `Sparkline` and `KpiCard` component under `components/ui/` or `components/charts/`.
3. **App shell** — sidebar dot/indicator, topbar breadcrumb-as-link.
4. **Channels hub (NEW)** — biggest creative deliverable; add as `app/avatars/[id]/page.tsx` (and move the old Master view to `app/avatars/[id]/master/page.tsx`, if it isn't already). Build it as a server component that fetches once and passes pre-computed aggregates to four client tile components.
5. **Channel tiles** — one component per channel for clean separation. Reusable structure (head/hero/viz/foot) but channel-specific visualization slot.
6. **Channel drill-ins** — Master / LinkedIn / Emails / Calls. Refresh chrome (KPI strip, chips, table styling, status badges) using existing components where possible.
7. **Drawer** — refresh `components/leads/LeadDetailDrawer.tsx`. Keep the existing data-fetching and notes-saving logic.
8. **Subtle polish** — backdrop-blur topbar, tabular numerics everywhere, hover/focus motion on tiles + rows.

## Open questions for the developer to confirm with the user

- Should the Channels hub replace the current `/avatars/[id]` (which today renders the Master view), or live at a new `/avatars/[id]/overview` route?
- The Pivot direction (Kanban, Sankey, dialer cards) is included as reference — should any pieces be ported as alternate views/modes inside Refined (e.g. a Kanban toggle on the Master page)?
- Speaker-notes "Best window 10–11am" copy on the Calls tile is placeholder — should this be computed from real data or kept as static copy until the analytics service supports it?
