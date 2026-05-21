"use client";

import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface StatusOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  value: T;
  options: StatusOption<T>[];
  variantFor: Record<T, "default" | "secondary" | "outline" | "destructive">;
  /**
   * Optional suffix inside the badge (e.g. "4d ago").
   */
  suffix?: string;
  onChange: (next: T) => void | Promise<void>;
}

export default function StatusCell<T extends string>({
  value,
  options,
  variantFor,
  suffix,
  onChange,
}: Props<T>) {
  const [isPending, startTransition] = useTransition();
  const label = options.find((o) => o.value === value)?.label ?? value;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isPending}
        className="inline-flex items-center bg-transparent border-0 p-0 disabled:opacity-60"
        onClick={(e) => e.stopPropagation()}
      >
        <Badge
          variant={variantFor[value]}
          className="cursor-pointer whitespace-nowrap"
        >
          {label}
          {suffix ? <span className="ml-1.5 opacity-70">· {suffix}</span> : null}
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onSelect={() => {
              if (opt.value === value) return;
              startTransition(async () => {
                await onChange(opt.value);
              });
            }}
            className={opt.value === value ? "font-medium" : undefined}
          >
            <Badge variant={variantFor[opt.value]} className="mr-2">
              {opt.label}
            </Badge>
            {opt.value === value && <span className="ml-auto text-xs">✓</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
