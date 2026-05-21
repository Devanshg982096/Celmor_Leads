"use client";

import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type SortingState,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { labelFor } from "@/lib/apollo-mapping";
import { getLeadValue } from "@/lib/leads-columns";
import type { Lead, LeadStatus, Profile } from "@/lib/types";

interface Props {
  leads: Lead[];
  visibleColumns: string[];
  profiles: Profile[];
}

const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  active: "Active",
  unqualified: "Unqualified",
  won: "Won",
  dead: "Dead",
};

const LEAD_STATUS_VARIANT: Record<LeadStatus, "default" | "secondary" | "outline" | "destructive"> =
  {
    new: "secondary",
    active: "default",
    unqualified: "outline",
    won: "default",
    dead: "destructive",
  };

export default function LeadsTable({ leads, visibleColumns, profiles }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [sorting, setSorting] = useState<SortingState>([]);

  const profileById = useMemo(() => {
    const m = new Map<string, Profile>();
    for (const p of profiles) m.set(p.id, p);
    return m;
  }, [profiles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return leads.filter((lead) => {
      if (statusFilter !== "all" && lead.lead_status !== statusFilter) return false;
      if (!q) return true;
      return (
        lead.name.toLowerCase().includes(q) ||
        lead.email.toLowerCase().includes(q) ||
        (lead.company ?? "").toLowerCase().includes(q)
      );
    });
  }, [leads, search, statusFilter]);

  const columns = useMemo<ColumnDef<Lead>[]>(() => {
    const cols: ColumnDef<Lead>[] = visibleColumns.map((key) => ({
      id: key,
      header: labelFor(key),
      accessorFn: (row: Lead) => getLeadValue(row, key),
      cell: (info) => {
        const value = info.getValue() as string;
        if (key === "linkedin_url" && value) {
          return (
            <a
              href={value}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline-offset-2 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              LinkedIn ↗
            </a>
          );
        }
        if (key === "email" && value) {
          return (
            <a
              href={`mailto:${value}`}
              className="text-primary underline-offset-2 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {value}
            </a>
          );
        }
        return value || <span className="text-muted-foreground">—</span>;
      },
    }));

    // Tail columns: owner + status (always visible, Step 4 makes them interactive)
    cols.push({
      id: "owner",
      header: "Owner",
      accessorFn: (row) =>
        row.owner_id ? profileById.get(row.owner_id)?.display_name ?? "Unknown" : "Unassigned",
      cell: (info) => {
        const v = info.getValue() as string;
        return v === "Unassigned" ? (
          <span className="text-muted-foreground">Unassigned</span>
        ) : (
          v
        );
      },
    });

    cols.push({
      id: "lead_status",
      header: "Status",
      accessorFn: (row) => row.lead_status,
      cell: (info) => {
        const v = info.getValue() as LeadStatus;
        return <Badge variant={LEAD_STATUS_VARIANT[v]}>{LEAD_STATUS_LABEL[v]}</Badge>;
      },
    });

    return cols;
  }, [visibleColumns, profileById]);

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search name, email or company…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as LeadStatus | "all")}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status: all" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Status: all</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="unqualified">Unqualified</SelectItem>
            <SelectItem value="won">Won</SelectItem>
            <SelectItem value="dead">Dead</SelectItem>
          </SelectContent>
        </Select>
        <p className="ml-auto text-sm text-muted-foreground">
          {filtered.length.toLocaleString()} of {leads.length.toLocaleString()} leads
        </p>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  return (
                    <TableHead
                      key={header.id}
                      className={canSort ? "cursor-pointer select-none" : undefined}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                    >
                      <span className="inline-flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{ asc: "▲", desc: "▼" }[header.column.getIsSorted() as string] ?? null}
                      </span>
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No leads match your filters.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
