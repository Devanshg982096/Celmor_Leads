"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { Columns3 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface ColumnDef {
  key: string;
  label: string;
  /** Columns you should not be able to lose, e.g. the person's name. */
  locked?: boolean;
}

/**
 * localStorage does not fire its own `storage` event in the tab that wrote the
 * value, so we notify subscribers ourselves.
 */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * Show/hide columns, remembered per table in localStorage.
 *
 * Deliberately not stored on the avatar: which columns you want visible is a
 * property of the person looking, not of the campaign, and two people working
 * the same list should not fight over it.
 */
export function useVisibleColumns(storageKey: string, columns: ColumnDef[]) {
  // Read through useSyncExternalStore rather than an effect. localStorage is
  // an external store, and treating it as one avoids both the render-then-
  // correct flicker and the setState-in-effect this would otherwise need.
  // The third argument is the server snapshot: nothing hidden, which matches
  // what the client renders before it has read anything.
  const raw = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(storageKey),
    () => null,
  );

  const hidden = useMemo(() => {
    if (!raw) return new Set<string>();
    try {
      return new Set(JSON.parse(raw) as string[]);
    } catch {
      // A corrupt preference should show everything, not break the table.
      return new Set<string>();
    }
  }, [raw]);

  const persist = useCallback(
    (next: Set<string>) => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify([...next]));
      } catch {
        // Private browsing and full storage both throw. Nothing to do beyond
        // leaving the columns as they are.
      }
      listeners.forEach((l) => l());
    },
    [storageKey],
  );

  const toggle = useCallback(
    (key: string) => {
      const col = columns.find((c) => c.key === key);
      if (col?.locked) return;
      const next = new Set(hidden);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      persist(next);
    },
    [columns, hidden, persist],
  );

  const showAll = useCallback(() => persist(new Set()), [persist]);

  const isVisible = useCallback((key: string) => !hidden.has(key), [hidden]);

  return { isVisible, toggle, showAll, hiddenCount: hidden.size };
}

interface Props {
  columns: ColumnDef[];
  isVisible: (key: string) => boolean;
  toggle: (key: string) => void;
  showAll: () => void;
  hiddenCount: number;
}

export default function ColumnPicker({
  columns,
  isVisible,
  toggle,
  showAll,
  hiddenCount,
}: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border-default)] bg-transparent px-2.5 text-[13px] text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-overlay)]">
        <Columns3 className="size-3.5" />
        Columns
        {hiddenCount > 0 && (
          <span className="text-[var(--text-tertiary)]">({hiddenCount} hidden)</span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[70vh] w-56 overflow-y-auto">
        <DropdownMenuLabel>Show columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((c) => (
          <DropdownMenuItem
            key={c.key}
            disabled={c.locked}
            closeOnClick={false}
            onClick={() => toggle(c.key)}
            className="flex items-center justify-between gap-2"
          >
            <span className={c.locked ? "text-[var(--text-tertiary)]" : undefined}>
              {c.label}
            </span>
            <span className="text-[var(--accent-primary)]">
              {isVisible(c.key) ? "✓" : ""}
            </span>
          </DropdownMenuItem>
        ))}
        {hiddenCount > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => showAll()}>Show all</DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
