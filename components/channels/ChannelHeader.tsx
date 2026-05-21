"use client";

import Link from "next/link";
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
  avatarName: string;
  channel: "Calls" | "LinkedIn" | "Emails";
  /** kebab-case URL segment for the channel route */
  channelSlug: "calls" | "linkedin" | "emails";
  myLeadsOnly: boolean;
  /** True when the current user has no Supabase id — disables the toggle. */
  canFilterByMe: boolean;
}

export default function ChannelHeader({
  avatars,
  avatarId,
  avatarName,
  channel,
  channelSlug,
  myLeadsOnly,
  canFilterByMe,
}: Props) {
  const router = useRouter();

  function switchAvatar(nextId: string) {
    // Preserve the my-leads param when jumping between avatars
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
    <div className="space-y-3 mb-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/" className="hover:underline">
          Avatars
        </Link>
        <span>/</span>
        <Link href={`/avatars/${avatarId}`} className="hover:underline">
          {avatarName}
        </Link>
        <span>/</span>
        <span className="text-foreground">{channel}</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{channel}</h1>

        <button
          type="button"
          onClick={toggleMyLeads}
          disabled={!canFilterByMe}
          className={
            "rounded-md border px-3 py-1.5 text-sm transition-colors disabled:opacity-50 " +
            (myLeadsOnly
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background hover:bg-accent")
          }
        >
          My leads only
        </button>

        <Select value={avatarId} onValueChange={(v) => switchAvatar(v ?? avatarId)}>
          <SelectTrigger className="w-64 ml-auto">
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
      </div>
    </div>
  );
}
