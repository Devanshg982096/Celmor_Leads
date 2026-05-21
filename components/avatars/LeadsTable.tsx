"use client";

import { useMemo, useState, useCallback } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import StatusCell from "@/components/leads/StatusCell";
import OwnerCell from "@/components/leads/OwnerCell";
import { labelFor } from "@/lib/apollo-mapping";
import { getLeadValue } from "@/lib/leads-columns";
import {
  CALL_STATUS_BADGE,
  CALL_STATUS_OPTIONS,
  EMAIL_STATUS_BADGE,
  EMAIL_STATUS_OPTIONS,
  LEAD_STATUS_BADGE,
  LEAD_STATUS_OPTIONS,
  LINKEDIN_STAGE_BADGE,
  LINKEDIN_STAGE_OPTIONS,
  relativeTime,
} from "@/lib/leads/labels";
import {
  updateCallStatus,
  updateEmailStatus,
  updateLeadOwner,
  updateLeadStatus,
  updateLinkedInStage,
} from "@/lib/leads/actions";
import type {
  CallStatus,
  EmailStatus,
  Lead,
  LeadStatus,
  LinkedInStage,
  Profile,
} from "@/lib/types";

interface Props {
  leads: Lead[];
  visibleColumns: string[];
  profiles: Profile[];
}

export default function LeadsTable({
  leads: initialLeads,
  visibleColumns,
  profiles,
}: Props) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeadStatus | "all">("all");
  const [sorting, setSorting] = useState<SortingState>([]);

  // Optimistic helper: patch a lead in local state, run server action, revert on error.
  const optimisticPatch = useCallback(
    async (leadId: string, patch: Partial<Lead>, action: () => Promise<void>) => {
      const previous = leads;
      setLeads((curr) =>
        curr.map((l) => (l.id === leadId ? { ...l, ...patch } : l))
      );
      try {
        await action();
      } catch (err) {
        setLeads(previous);
        // eslint-disable-next-line no-console
        console.error("Failed to update lead:", err);
        alert(err instanceof Error ? err.message : "Update failed.");
      }
    },
    [leads]
  );

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

    // ─── Interactive pipeline columns ──────────────────────────────────────
    cols.push({
      id: "owner",
      header: "Owner",
      cell: (info) => {
        const lead = info.row.original;
        return (
          <OwnerCell
            ownerId={lead.owner_id}
            profiles={profiles}
            onChange={(next) =>
              optimisticPatch(lead.id, { owner_id: next }, () =>
                updateLeadOwner(lead.id, next)
              )
            }
          />
        );
      },
    });

    cols.push({
      id: "email_status",
      header: "Email",
      cell: (info) => {
        const lead = info.row.original;
        return (
          <StatusCell<EmailStatus>
            value={lead.email_status}
            options={EMAIL_STATUS_OPTIONS}
            variantFor={EMAIL_STATUS_BADGE}
            suffix={
              lead.email_status !== "none"
                ? relativeTime(lead.email_status_updated_at)
                : undefined
            }
            onChange={(next) =>
              optimisticPatch(
                lead.id,
                {
                  email_status: next,
                  email_status_updated_at: new Date().toISOString(),
                },
                () => updateEmailStatus(lead.id, next)
              )
            }
          />
        );
      },
    });

    cols.push({
      id: "linkedin_stage",
      header: "LinkedIn",
      cell: (info) => {
        const lead = info.row.original;
        return (
          <StatusCell<LinkedInStage>
            value={lead.linkedin_stage}
            options={LINKEDIN_STAGE_OPTIONS}
            variantFor={LINKEDIN_STAGE_BADGE}
            suffix={
              lead.linkedin_stage !== "none"
                ? relativeTime(lead.linkedin_stage_updated_at)
                : undefined
            }
            onChange={(next) =>
              optimisticPatch(
                lead.id,
                {
                  linkedin_stage: next,
                  linkedin_stage_updated_at: new Date().toISOString(),
                },
                () => updateLinkedInStage(lead.id, next)
              )
            }
          />
        );
      },
    });

    cols.push({
      id: "call_status",
      header: "Call",
      cell: (info) => {
        const lead = info.row.original;
        return (
          <StatusCell<CallStatus>
            value={lead.call_status}
            options={CALL_STATUS_OPTIONS}
            variantFor={CALL_STATUS_BADGE}
            suffix={
              lead.call_status !== "not_called"
                ? relativeTime(lead.call_status_updated_at)
                : undefined
            }
            onChange={(next) =>
              optimisticPatch(
                lead.id,
                {
                  call_status: next,
                  call_status_updated_at: new Date().toISOString(),
                },
                () => updateCallStatus(lead.id, next)
              )
            }
          />
        );
      },
    });

    cols.push({
      id: "lead_status",
      header: "Status",
      cell: (info) => {
        const lead = info.row.original;
        return (
          <StatusCell<LeadStatus>
            value={lead.lead_status}
            options={LEAD_STATUS_OPTIONS}
            variantFor={LEAD_STATUS_BADGE}
            onChange={(next) =>
              optimisticPatch(
                lead.id,
                {
                  lead_status: next,
                  lead_status_updated_at: new Date().toISOString(),
                },
                () => updateLeadStatus(lead.id, next)
              )
            }
          />
        );
      },
    });

    return cols;
  }, [visibleColumns, profiles, optimisticPatch]);

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
            {LEAD_STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
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
