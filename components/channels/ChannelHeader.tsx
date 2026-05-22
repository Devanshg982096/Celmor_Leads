"use client";

import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Avatar } from "@/lib/types";

interface Props {
  avatars: Pick<Avatar, "id" | "name">[];
  avatarId: string;
  channelSlug: "calls" | "linkedin" | "emails";
  myLeadsOnly: boolean;
  /** True when the current user has no Supabase id — disables the toggle. */
  canFilterByMe: boolean;
}

/**
 * Right-aligned actions for channel pages: My leads toggle + avatar switcher.
 * Rendered inside AppShell's TopBar `actions` slot — the breadcrumb is
 * handled by the shell itself.
 */
export default function ChannelHeader({
  avatars,
  avatarId,
  channelSlug,
  myLeadsOnly,
  canFilterByMe,
}: Props) {
  const router = useRouter();

  function switchAvatar(nextId: string) {
    const params = !myLeadsOnly ? "?my=0" : "";
    router.push(`/avatars/${nextId}/${channelSlug}${params}`);
  }

  function toggleMyLeads() {
    const params = myLeadsOnly ? "?my=0" : "";
    router.replace(`/avatars/${avatarId}/${channelSlug}${params}`, {
      scroll: false,
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={toggleMyLeads}
        disabled={!canFilterByMe}
        className={
          "rounded-md border px-3 py-1.5 text-sm transition-colors disabled:opacity-50 " +
          (myLeadsOnly
            ? "bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]"
            : "border-[var(--border-default)] bg-transparent text-[var(--text-primary)] hover:bg-[var(--bg-overlay)]")
        }
      >
        My leads only
      </button>

      <Select value={avatarId} onValueChange={(v) => switchAvatar(v ?? avatarId)}>
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Switch avatar" />
        </SelectTrigger>
        <SelectContent>
          {avatars.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
