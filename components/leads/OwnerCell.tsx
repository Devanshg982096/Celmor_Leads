"use client";

import { useTransition } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Profile } from "@/lib/types";

interface Props {
  ownerId: string | null;
  profiles: Profile[];
  onChange: (next: string | null) => void | Promise<void>;
}

export default function OwnerCell({ ownerId, profiles, onChange }: Props) {
  const [isPending, startTransition] = useTransition();
  const current = ownerId ? profiles.find((p) => p.id === ownerId) : null;
  const label = current?.display_name ?? "Unassigned";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isPending}
        onClick={(e) => e.stopPropagation()}
        className={
          "rounded px-1.5 py-0.5 text-sm border-0 bg-transparent hover:bg-accent disabled:opacity-60 " +
          (current ? "text-foreground" : "text-muted-foreground")
        }
      >
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        {profiles.map((p) => (
          <DropdownMenuItem
            key={p.id}
            onSelect={() => {
              if (p.id === ownerId) return;
              startTransition(async () => {
                await onChange(p.id);
              });
            }}
            className={p.id === ownerId ? "font-medium" : undefined}
          >
            {p.display_name}
            {p.id === ownerId && <span className="ml-auto text-xs">✓</span>}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            if (ownerId === null) return;
            startTransition(async () => {
              await onChange(null);
            });
          }}
          className={ownerId === null ? "font-medium" : "text-muted-foreground"}
        >
          Unassigned
          {ownerId === null && <span className="ml-auto text-xs">✓</span>}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
