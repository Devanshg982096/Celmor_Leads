"use client";

import { useMemo, useCallback, useTransition } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CALL_STATUS_OPTIONS,
  EMAIL_STATUS_OPTIONS,
  LEAD_STATUS_OPTIONS,
  LINKEDIN_STAGE_OPTIONS,
} from "@/lib/leads/labels";
import type {
  CallStatus,
  EmailStatus,
  LeadStatus,
  LinkedInStage,
  Profile,
} from "@/lib/types";

export const ALL = "all";

export interface FilterState {
  q: string;
  owner: string; // "all" | "me" | "unassigned" | <userId>
  lead_status: LeadStatus | "all";
  email_status: EmailStatus | "all";
  linkedin_stage: LinkedInStage | "all";
  call_status: CallStatus | "all";
  show_unqualified: boolean;
}

export function emptyFilterState(): FilterState {
  return {
    q: "",
    owner: ALL,
    lead_status: ALL,
    email_status: ALL,
    linkedin_stage: ALL,
    call_status: ALL,
    show_unqualified: false,
  };
}

/**
 * Read the current filter state out of URL search params.
 */
export function filtersFromSearchParams(
  params: URLSearchParams,
): FilterState {
  return {
    q: params.get("q") ?? "",
    owner: params.get("owner") ?? ALL,
    lead_status: (params.get("status") ?? ALL) as FilterState["lead_status"],
    email_status: (params.get("email") ?? ALL) as FilterState["email_status"],
    linkedin_stage: (params.get("linkedin") ?? ALL) as FilterState["linkedin_stage"],
    call_status: (params.get("call") ?? ALL) as FilterState["call_status"],
    show_unqualified: params.get("show_unqualified") === "1",
  };
}

interface Props {
  profiles: Profile[];
  currentUserId: string;
  resultCount: number;
  totalCount: number;
}

export default function FilterBar({
  profiles,
  currentUserId,
  resultCount,
  totalCount,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const state = useMemo(
    () => filtersFromSearchParams(new URLSearchParams(params.toString())),
    [params],
  );

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (!value || value === ALL || value === "") next.delete(key);
      else next.set(key, value);
      const qs = next.toString();
      const url = qs ? `${pathname}?${qs}` : pathname;
      startTransition(() => router.replace(url, { scroll: false }));
    },
    [params, pathname, router],
  );

  const ownerOptions = useMemo(() => {
    const opts: { value: string; label: string }[] = [
      { value: ALL, label: "All owners" },
    ];
    if (currentUserId) opts.push({ value: "me", label: "My leads only" });
    opts.push({ value: "unassigned", label: "Unassigned" });
    for (const p of profiles) {
      opts.push({ value: p.id, label: p.display_name });
    }
    return opts;
  }, [profiles, currentUserId]);

  const activeChips = useMemo(() => {
    const chips: { key: keyof FilterState | "q"; label: string }[] = [];
    if (state.q) chips.push({ key: "q", label: `Search: "${state.q}"` });
    if (state.owner !== ALL) {
      const opt = ownerOptions.find((o) => o.value === state.owner);
      chips.push({ key: "owner", label: `Owner: ${opt?.label ?? state.owner}` });
    }
    if (state.lead_status !== ALL) {
      const opt = LEAD_STATUS_OPTIONS.find((o) => o.value === state.lead_status);
      chips.push({ key: "lead_status", label: `Status: ${opt?.label}` });
    }
    if (state.email_status !== ALL) {
      const opt = EMAIL_STATUS_OPTIONS.find((o) => o.value === state.email_status);
      chips.push({ key: "email_status", label: `Email: ${opt?.label}` });
    }
    if (state.linkedin_stage !== ALL) {
      const opt = LINKEDIN_STAGE_OPTIONS.find((o) => o.value === state.linkedin_stage);
      chips.push({ key: "linkedin_stage", label: `LinkedIn: ${opt?.label}` });
    }
    if (state.call_status !== ALL) {
      const opt = CALL_STATUS_OPTIONS.find((o) => o.value === state.call_status);
      chips.push({ key: "call_status", label: `Call: ${opt?.label}` });
    }
    return chips;
  }, [state, ownerOptions]);

  function clearChip(key: keyof FilterState | "q") {
    const map: Record<typeof key, string> = {
      q: "q",
      owner: "owner",
      lead_status: "status",
      email_status: "email",
      linkedin_stage: "linkedin",
      call_status: "call",
      show_unqualified: "show_unqualified",
    } as const;
    setParam(map[key], null);
  }

  function clearAll() {
    startTransition(() => router.replace(pathname, { scroll: false }));
  }

  const myLeadsActive = state.owner === "me";
  const showUnqualifiedActive = state.show_unqualified;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={state.q}
          onChange={(e) => setParam("q", e.target.value)}
          placeholder="Search name, email or company…"
          className="max-w-xs"
        />

        <button
          type="button"
          onClick={() => setParam("owner", myLeadsActive ? null : "me")}
          disabled={!currentUserId}
          className={
            "rounded-md border px-3 py-1.5 text-sm transition-colors disabled:opacity-50 " +
            (myLeadsActive
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background hover:bg-accent")
          }
        >
          My leads only
        </button>

        <button
          type="button"
          onClick={() => setParam("show_unqualified", showUnqualifiedActive ? null : "1")}
          className={
            "rounded-md border px-3 py-1.5 text-sm transition-colors " +
            (showUnqualifiedActive
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background hover:bg-accent")
          }
        >
          Show unqualified
        </button>

        <FilterSelect
          value={state.owner}
          onChange={(v) => setParam("owner", v)}
          placeholder="Owner"
          width="w-44"
          options={ownerOptions}
        />

        <FilterSelect
          value={state.lead_status}
          onChange={(v) => setParam("status", v)}
          placeholder="Lead status"
          width="w-40"
          options={[
            { value: ALL, label: "All statuses" },
            ...LEAD_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
          ]}
        />

        <FilterSelect
          value={state.email_status}
          onChange={(v) => setParam("email", v)}
          placeholder="Email"
          width="w-40"
          options={[
            { value: ALL, label: "All email" },
            ...EMAIL_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
          ]}
        />

        <FilterSelect
          value={state.linkedin_stage}
          onChange={(v) => setParam("linkedin", v)}
          placeholder="LinkedIn"
          width="w-44"
          options={[
            { value: ALL, label: "All LinkedIn" },
            ...LINKEDIN_STAGE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
          ]}
        />

        <FilterSelect
          value={state.call_status}
          onChange={(v) => setParam("call", v)}
          placeholder="Call"
          width="w-40"
          options={[
            { value: ALL, label: "All call" },
            ...CALL_STATUS_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
          ]}
        />

        <p className="ml-auto text-sm text-muted-foreground">
          {resultCount.toLocaleString()} of {totalCount.toLocaleString()} leads
        </p>
      </div>

      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeChips.map((chip) => (
            <Badge
              key={chip.key}
              variant="secondary"
              className="cursor-pointer pr-1.5"
              onClick={() => clearChip(chip.key)}
            >
              {chip.label}
              <span className="ml-1.5 opacity-70" aria-hidden>
                ×
              </span>
            </Badge>
          ))}
          <button
            type="button"
            onClick={clearAll}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  width,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  width: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v ?? ALL)}>
      <SelectTrigger className={width}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
