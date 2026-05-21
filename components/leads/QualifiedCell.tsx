"use client";

import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UNQUALIFIED_REASON_OPTIONS,
  labelForReason,
  relativeTime,
} from "@/lib/leads/labels";
import type { QualifiedStatus, UnqualifiedReason } from "@/lib/types";

interface Props {
  qualified: QualifiedStatus;
  reason: UnqualifiedReason | null;
  unqualifiedAt: string | null;
  onUnqualify: (reason: UnqualifiedReason) => Promise<void>;
  onRequalify: () => Promise<void>;
}

export default function QualifiedCell({
  qualified,
  reason,
  unqualifiedAt,
  onUnqualify,
  onRequalify,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pendingReason, setPendingReason] = useState<UnqualifiedReason | "">("");
  const [isPending, startTransition] = useTransition();
  const isQualified = qualified === "qualified";

  const handleUnqualify = () => {
    if (!pendingReason) return;
    startTransition(async () => {
      await onUnqualify(pendingReason as UnqualifiedReason);
      setPendingReason("");
      setOpen(false);
    });
  };

  const handleRequalify = () => {
    startTransition(async () => {
      await onRequalify();
      setOpen(false);
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={isPending}
        onClick={(e) => e.stopPropagation()}
        className="bg-transparent border-0 p-0 disabled:opacity-60"
      >
        <Badge
          variant="outline"
          className={
            "cursor-pointer whitespace-nowrap " +
            (isQualified
              ? "border-green-600/40 bg-green-600/10 text-green-700 dark:text-green-300"
              : "border-destructive/50 bg-destructive/10 text-destructive")
          }
        >
          {isQualified ? "Qualified" : "Unqualified"}
        </Badge>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-80"
        onClick={(e) => e.stopPropagation()}
      >
        {isQualified ? (
          <>
            <p className="text-sm font-medium">Unqualify this lead</p>
            <p className="text-xs text-muted-foreground">
              They&apos;ll be hidden from channel views and the master sheet (unless
              you toggle &quot;Show unqualified&quot;).
            </p>
            <Select
              value={pendingReason || undefined}
              onValueChange={(v) => setPendingReason((v ?? "") as UnqualifiedReason | "")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pick a reason…" />
              </SelectTrigger>
              <SelectContent>
                {UNQUALIFIED_REASON_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleUnqualify}
                disabled={isPending || !pendingReason}
              >
                {isPending ? "Unqualifying…" : "Unqualify"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm font-medium">Currently unqualified</p>
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>
                Reason:{" "}
                <span className="text-foreground">
                  {reason ? labelForReason(reason) : "—"}
                </span>
              </p>
              {unqualifiedAt && (
                <p>
                  When: <span className="text-foreground">{relativeTime(unqualifiedAt)}</span>
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleRequalify}
                disabled={isPending}
              >
                {isPending ? "Re-qualifying…" : "Re-qualify"}
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
