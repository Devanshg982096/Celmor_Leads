"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LEAD_STATUS_OPTIONS } from "@/lib/leads/labels";
import type { LeadStatus, Profile } from "@/lib/types";

interface Props {
  selectedCount: number;
  profiles: Profile[];
  onClear: () => void;
  onAssignOwner: (ownerId: string | null) => Promise<void>;
  onMarkSmartleadSent: () => Promise<void>;
  onSetLeadStatus: (status: LeadStatus) => Promise<void>;
}

export default function BulkActionBar({
  selectedCount,
  profiles,
  onClear,
  onAssignOwner,
  onMarkSmartleadSent,
  onSetLeadStatus,
}: Props) {
  const [isPending, startTransition] = useTransition();
  if (selectedCount === 0) return null;

  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      await fn();
    });

  return (
    <div className="sticky top-0 z-10 -mx-6 px-6 py-2 bg-primary text-primary-foreground border-b shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center gap-3">
        <span className="text-sm font-medium">
          {selectedCount.toLocaleString()} selected
        </span>

        <div className="ml-4 flex flex-wrap items-center gap-2">
          {/* Assign Owner */}
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={isPending}
              className="rounded-md bg-primary-foreground/10 hover:bg-primary-foreground/20 px-3 py-1 text-sm border-0 disabled:opacity-60"
            >
              Assign owner ▾
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {profiles.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onClick={() => run(() => onAssignOwner(p.id))}
                >
                  {p.display_name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => run(() => onAssignOwner(null))}
                className="text-muted-foreground"
              >
                Unassigned
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mark Smartlead Sent */}
          <Button
            variant="secondary"
            size="sm"
            disabled={isPending}
            onClick={() => run(onMarkSmartleadSent)}
          >
            Mark Smartlead Sent
          </Button>

          {/* Set Lead Status */}
          <DropdownMenu>
            <DropdownMenuTrigger
              disabled={isPending}
              className="rounded-md bg-primary-foreground/10 hover:bg-primary-foreground/20 px-3 py-1 text-sm border-0 disabled:opacity-60"
            >
              Set lead status ▾
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {LEAD_STATUS_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => run(() => onSetLeadStatus(opt.value))}
                >
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <button
          type="button"
          onClick={onClear}
          disabled={isPending}
          className="ml-auto text-sm underline-offset-2 hover:underline opacity-90"
        >
          Clear selection
        </button>
      </div>
    </div>
  );
}
