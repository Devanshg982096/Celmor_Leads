import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ChannelTileTheme {
  glow: string;
  border: string;
  iconBg: string;
  iconFg: string;
  accent: string;
}

interface Props {
  href: string;
  /** Channel-specific theme (CSS custom props). */
  theme: ChannelTileTheme;
  /** Top-left lucide icon. */
  icon: React.ReactNode;
  /** Tiny uppercase kicker shown next to the icon (e.g. "MASTER"). */
  name: string;
  /** Questrial 22px title under the icon row. */
  title: string;
  /** Optional small stat in the top-right (mono number + label below). */
  kicker?: { value: string; label: string };
  /** Big Questrial 64px hero number (or rate). */
  bigNumber: React.ReactNode;
  /** Small grey subtitle under the hero number. */
  bigSubtitle: string;
  /** Channel-specific visualisation rendered between the hero and footer. */
  children?: React.ReactNode;
  /** Up-to-3 small stats shown on the bottom-left. */
  footStats: { label: string; value: React.ReactNode }[];
  /** Label inside the "Open ... →" link on the bottom-right. */
  openLabel: string;
}

export default function ChannelTile({
  href,
  theme,
  icon,
  name,
  title,
  kicker,
  bigNumber,
  bigSubtitle,
  children,
  footStats,
  openLabel,
}: Props) {
  return (
    <Link
      href={href}
      className={cn(
        "channel-tile group/tile relative flex min-h-[320px] flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-7 pb-6 transition-[transform,border-color] duration-[180ms] focus:outline-none",
        "hover:-translate-y-0.5 hover:shadow-md",
      )}
      style={
        {
          // Tile-specific CSS vars consumed by .channel-tile::before
          // (glow) and .channel-tile:hover (border colour).
          "--tile-glow": theme.glow,
          "--tile-border": theme.border,
        } as React.CSSProperties
      }
    >
      {/* Head: icon + label/title (+ optional right kicker) */}
      <div className="relative z-[1] mb-6 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px]"
            style={{ background: theme.iconBg, color: theme.iconFg }}
            aria-hidden
          >
            {icon}
          </span>
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--text-tertiary)]">
              {name}
            </p>
            <p className="font-display text-[22px] leading-[1.1] tracking-[-0.01em] text-[var(--text-primary)]">
              {title}
            </p>
          </div>
        </div>
        {kicker && (
          <div className="text-right text-[11.5px] text-[var(--text-tertiary)]">
            <p
              className="font-mono text-[var(--text-primary)]"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {kicker.value}
            </p>
            <p>{kicker.label}</p>
          </div>
        )}
      </div>

      {/* Hero: big number + small subtitle */}
      <div className="relative z-[1] mb-4 flex flex-1 flex-col justify-center">
        <div
          className="font-display font-normal text-[64px] leading-[0.95] tracking-[-0.03em] text-[var(--text-primary)]"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {bigNumber}
        </div>
        <p className="mt-1.5 text-[13px] text-[var(--text-secondary)]">
          {bigSubtitle}
        </p>
      </div>

      {/* Channel-specific viz slot */}
      {children}

      {/* Foot */}
      <footer
        className="relative z-[1] mt-auto flex items-center justify-between gap-3 border-t pt-[18px]"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div className="flex gap-[18px]">
          {footStats.map((s) => (
            <div key={s.label}>
              <p className="mb-0.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--text-tertiary)]">
                {s.label}
              </p>
              <p
                className="font-mono text-[14px] font-medium"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {s.value}
              </p>
            </div>
          ))}
        </div>
        <span
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium transition-[gap]"
          style={{ color: theme.accent }}
        >
          {openLabel}
          <ArrowRight className="size-3.5" />
        </span>
      </footer>
    </Link>
  );
}

export const TILE_THEMES: Record<
  "master" | "linkedin" | "emails" | "calls",
  ChannelTileTheme
> = {
  master: {
    glow: "rgba(99, 102, 241, 0.08)",
    border: "var(--accent-primary)",
    iconBg: "rgba(99, 102, 241, 0.14)",
    iconFg: "var(--accent-soft)",
    accent: "var(--accent-soft)",
  },
  linkedin: {
    glow: "rgba(96, 165, 250, 0.08)",
    border: "#60A5FA",
    iconBg: "rgba(96, 165, 250, 0.14)",
    iconFg: "#93C5FD",
    accent: "#93C5FD",
  },
  emails: {
    glow: "rgba(52, 211, 153, 0.06)",
    border: "#34D399",
    iconBg: "rgba(52, 211, 153, 0.14)",
    iconFg: "#6EE7B7",
    accent: "#6EE7B7",
  },
  calls: {
    glow: "rgba(251, 191, 36, 0.06)",
    border: "#FBBF24",
    iconBg: "rgba(251, 191, 36, 0.14)",
    iconFg: "#FCD34D",
    accent: "#FCD34D",
  },
};
