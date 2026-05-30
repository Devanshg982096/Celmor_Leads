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
  onPushToSmartlead: () => void;
  onSetLeadStatus: (status: LeadStatus) => Promise<void>;
}

/**
 * Floating accent-bordered bar that appears above the table whenever rows are
 * selected. Uses the redesign's --accent-subtle outer halo for affordance.
 */
export default function BulkActionBar({
  selectedCount,
  profiles,
  onClear,
  onAssignOwner,
  onPushToSmartlead,
  onSetLeadStatus,
}: Props) {
  const [isPending, startTransition] = useTransition();
  if (selectedCount === 0) return null;

  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      await fn();
    });

  return (
    <div className="bulk-bar-glow mb-3 flex flex-wrap items-center gap-3 px-3 py-2">
      <span
        className="font-mono text-[13px] font-semibold text-[var(--accent-soft)]"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {selectedCount.toLocaleString("en-GB")}
      </span>
      <span className="text-[12px] text-[var(--text-secondary)]">selected</span>

      <div className="ml-2 flex flex-wrap items-center gap-2">
        {/* Assign Owner */}
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={isPending}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-overlay)] px-2.5 text-[12px] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-60"
          >
            Assign owner
            <span aria-hidden className="text-[var(--text-tertiary)]">▾</span>
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
              className="text-[var(--text-tertiary)]"
            >
              Unassigned
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Push to Smartlead campaign */}
        <Button
          variant="secondary"
          size="sm"
          disabled={isPending}
          onClick={onPushToSmartlead}
        >
          Push to campaign…
        </Button>

        {/* Set Lead Status */}
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={isPending}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-overlay)] px-2.5 text-[12px] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-60"
          >
            Set lead status
            <span aria-hidden className="text-[var(--text-tertiary)]">▾</span>
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
        className="ml-auto text-[12px] text-[var(--text-tertiary)] underline-offset-2 hover:text-[var(--text-primary)] hover:underline"
      >
        Clear
      </button>
    </div>
  );
}
