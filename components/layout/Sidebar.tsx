"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
} from "lucide-react";
import NaradaLogo from "@/components/brand/NaradaLogo";
import UserAvatarBubble from "@/components/ui/UserAvatarBubble";
import { cn } from "@/lib/utils";
import type { Avatar } from "@/lib/types";

const STORAGE_KEY = "narada-sidebar-collapsed";

interface Props {
  avatars: Pick<Avatar, "id" | "name">[];
  user: { id: string; displayName: string };
}

export default function Sidebar({ avatars, user }: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "1") setCollapsed(true);
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  // Active avatar = /avatars/[id]/...
  const activeAvatarId = (() => {
    const match = pathname.match(/^\/avatars\/([^/]+)/);
    if (!match) return null;
    if (match[1] === "new") return null;
    return match[1];
  })();
  const settingsActive = pathname.startsWith("/settings");

  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "flex h-screen flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-base)] transition-[width] duration-200 ease-out",
        collapsed ? "w-14" : "w-60",
      )}
    >
      {/* Header — logo + collapse toggle */}
      <div className="flex flex-col gap-3 px-3 pt-4">
        <Link
          href="/"
          aria-label="Narada home"
          className={cn(
            "inline-flex items-center",
            collapsed ? "justify-center" : "px-1",
          )}
        >
          <NaradaLogo
            size="md"
            variant={collapsed ? "icon-only" : "full"}
          />
        </Link>

        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "inline-flex h-7 items-center gap-2 rounded-sm px-2 text-xs text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-overlay)] hover:text-[var(--text-primary)]",
            collapsed ? "justify-center" : "justify-start",
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <>
              <PanelLeftClose className="size-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>

      {/* Nav: Avatars list */}
      <nav className="mt-4 flex flex-1 flex-col overflow-y-auto px-2">
        {!collapsed && (
          <p className="px-2 pb-2 text-[0.7rem] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
            Avatars
          </p>
        )}

        <ul className="flex flex-col gap-0.5">
          {avatars.map((a) => {
            const active = a.id === activeAvatarId;
            return (
              <li key={a.id}>
                <Link
                  href={`/avatars/${a.id}`}
                  title={collapsed ? a.name : undefined}
                  className={cn(
                    "group relative flex items-center gap-2 rounded-sm py-1.5 text-sm transition-colors",
                    collapsed ? "justify-center px-0" : "px-2",
                    active
                      ? "bg-[var(--bg-overlay)] text-[var(--text-primary)] font-medium"
                      : "text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)] hover:text-[var(--text-primary)]",
                  )}
                >
                  {active && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-[var(--accent-primary)]"
                    />
                  )}
                  {/* Coloured dot serves as the icon when collapsed too.
                      Active dot picks up a soft glow from --accent-glow. */}
                  <span
                    className="size-[6px] shrink-0 rounded-full"
                    style={{
                      backgroundColor: active
                        ? "var(--accent-primary)"
                        : "var(--text-quaternary)",
                      boxShadow: active
                        ? "0 0 8px var(--accent-glow)"
                        : undefined,
                    }}
                  />
                  {!collapsed && (
                    <span className="truncate flex-1">{a.name}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {!collapsed && (
          <Link
            href="/avatars/new"
            className={cn(
              "mt-2 inline-flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-overlay)] hover:text-[var(--text-primary)]",
            )}
          >
            <Plus className="size-4" />
            <span>New avatar</span>
          </Link>
        )}
        {collapsed && (
          <Link
            href="/avatars/new"
            title="New avatar"
            className="mt-2 inline-flex justify-center rounded-sm py-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-overlay)] hover:text-[var(--text-primary)]"
          >
            <Plus className="size-4" />
          </Link>
        )}
      </nav>

      {/* Footer: settings + user */}
      <div className="border-t border-[var(--border-subtle)] px-2 py-3">
        <Link
          href="/settings"
          title={collapsed ? "Settings" : undefined}
          className={cn(
            "flex items-center gap-2 rounded-sm py-1.5 text-sm transition-colors",
            collapsed ? "justify-center px-0" : "px-2",
            settingsActive
              ? "bg-[var(--bg-overlay)] text-[var(--text-primary)]"
              : "text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)] hover:text-[var(--text-primary)]",
          )}
        >
          <Settings className="size-4 shrink-0" />
          {!collapsed && <span>Settings</span>}
        </Link>

        <div
          className={cn(
            "mt-2 flex items-center gap-2 rounded-sm py-1.5 text-sm",
            collapsed ? "justify-center px-0" : "px-2",
          )}
        >
          <UserAvatarBubble id={user.id} name={user.displayName} size={26} />
          {!collapsed && (
            <span className="truncate text-[var(--text-primary)]">
              {user.displayName}
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}
