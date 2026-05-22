"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Grid, Layers, Users, Mail, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { slug: "hub", label: "Channels", icon: Grid },
  { slug: "master", label: "Master", icon: Layers },
  { slug: "linkedin", label: "LinkedIn", icon: Users },
  { slug: "emails", label: "Emails", icon: Mail },
  { slug: "calls", label: "Calls", icon: Phone },
] as const;

type TabSlug = (typeof TABS)[number]["slug"];

function hrefFor(avatarId: string, slug: TabSlug): string {
  return slug === "hub"
    ? `/avatars/${avatarId}`
    : `/avatars/${avatarId}/${slug}`;
}

interface Props {
  avatarId: string;
}

/**
 * Segmented control sitting at the top of every Avatar-scoped channel page.
 * Active tab is derived from the current pathname so callers don't need to
 * pass it explicitly.
 */
export default function ChannelTabs({ avatarId }: Props) {
  const pathname = usePathname();

  function isActive(slug: TabSlug): boolean {
    const hubPath = `/avatars/${avatarId}`;
    if (slug === "hub") return pathname === hubPath;
    return pathname.startsWith(`${hubPath}/${slug}`);
  }

  return (
    <div
      role="tablist"
      className="inline-flex gap-0.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-overlay)] p-[3px]"
    >
      {TABS.map((t) => {
        const active = isActive(t.slug);
        const Icon = t.icon;
        return (
          <Link
            key={t.slug}
            href={hrefFor(avatarId, t.slug)}
            role="tab"
            aria-selected={active}
            className={cn(
              "inline-flex h-[26px] items-center gap-1.5 rounded-[4px] px-3 text-[12.5px] font-medium transition-colors",
              active
                ? "bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-[0_1px_2px_rgba(0,0,0,0.3)]"
                : "text-[var(--text-tertiary)] hover:text-[var(--text-primary)]",
            )}
          >
            <Icon className="size-[13px]" />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
