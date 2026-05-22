"use client";

import { useTransition } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import UserAvatarBubble from "@/components/ui/UserAvatarBubble";
import type { Profile } from "@/lib/types";

interface Props {
  ownerId: string | null;
  profiles: Profile[];
  onChange: (next: string | null) => void | Promise<void>;
}

/**
 * Table owner cell. Shows a 20×20 colour-coded initials avatar + first name
 * when assigned; "Unassigned" muted text otherwise. Click anywhere on the
 * pill to open the assign-to dropdown.
 */
export default function OwnerCell({ ownerId, profiles, onChange }: Props) {
  const [isPending, startTransition] = useTransition();
  const current = ownerId ? profiles.find((p) => p.id === ownerId) : null;
  const firstName = current
    ? current.display_name.split(/\s+/)[0]
    : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isPending}
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-2 rounded-md border-0 bg-transparent px-1.5 py-0.5 text-[12.5px] transition-colors hover:bg-[var(--bg-overlay)] disabled:opacity-60"
      >
        {current ? (
          <>
            <UserAvatarBubble
              id={current.id}
              name={current.display_name}
              size={20}
            />
            <span className="text-[var(--text-primary)]">{firstName}</span>
          </>
        ) : (
          <span className="text-[var(--text-tertiary)]">Unassigned</span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        {profiles.map((p) => (
          <DropdownMenuItem
            key={p.id}
            onClick={() => {
              if (p.id === ownerId) return;
              startTransition(async () => {
                await onChange(p.id);
              });
            }}
            className={p.id === ownerId ? "font-medium" : undefined}
          >
            <UserAvatarBubble id={p.id} name={p.display_name} size={20} />
            <span>{p.display_name}</span>
            {p.id === ownerId && (
              <span className="ml-auto text-[var(--text-tertiary)]">✓</span>
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            if (ownerId === null) return;
            startTransition(async () => {
              await onChange(null);
            });
          }}
          className={
            ownerId === null
              ? "font-medium"
              : "text-[var(--text-tertiary)]"
          }
        >
          Unassigned
          {ownerId === null && (
            <span className="ml-auto text-[var(--text-tertiary)]">✓</span>
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
