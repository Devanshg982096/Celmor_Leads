"use client";

import {
  useMemo,
  useState,
  useCallback,
  useRef,
  useEffect,
  useContext,
  createContext,
} from "react";
import { useSearchParams } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type SortingState,
  type ColumnDef,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import StatusCell from "@/components/leads/StatusCell";
import OwnerCell from "@/components/leads/OwnerCell";
import QualifiedCell from "@/components/leads/QualifiedCell";
import BulkActionBar from "@/components/leads/BulkActionBar";
import LeadDetailDrawer from "@/components/leads/LeadDetailDrawer";
import FilterBar, { filtersFromSearchParams } from "@/components/leads/FilterBar";
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
import { ALL } from "@/components/leads/FilterBar";
import {
  bulkUpdateEmailStatus,
  bulkUpdateLeadOwner,
  bulkUpdateLeadStatus,
  requalifyLead,
  unqualifyLead,
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
  UnqualifiedReason,
} from "@/lib/types";

interface Props {
  leads: Lead[];
  visibleColumns: string[];
  profiles: Profile[];
  currentUserId: string;
}

// ─── Selection context ──────────────────────────────────────────────────
// Keeps selection state out of the tanstack `columns` memo so toggling a
// checkbox doesn't invalidate every column def (which would re-render all
// ~6 heavy dropdown cells per row).
interface SelectionCtx {
  isSelected: (id: string) => boolean;
  toggleRow: (id: string, check: boolean) => void;
  toggleAllFiltered: (check: boolean) => void;
  allFilteredSelected: boolean;
  someFilteredSelected: boolean;
}
const SelectionContext = createContext<SelectionCtx | null>(null);
function useSelection() {
  const v = useContext(SelectionContext);
  if (!v) throw new Error("SelectionContext missing");
  return v;
}

function RowCheckbox({ id }: { id: string }) {
  const { isSelected, toggleRow } = useSelection();
  return (
    <Checkbox
      checked={isSelected(id)}
      onCheckedChange={(v) => toggleRow(id, v === true)}
      aria-label="Select row"
      onClick={(e) => e.stopPropagation()}
    />
  );
}

function HeaderCheckbox() {
  const { allFilteredSelected, someFilteredSelected, toggleAllFiltered } =
    useSelection();
  return (
    <Checkbox
      checked={allFilteredSelected}
      indeterminate={someFilteredSelected && !allFilteredSelected}
      onCheckedChange={(v) => toggleAllFiltered(v === true)}
      aria-label="Select all filtered leads"
    />
  );
}

export default function LeadsTable({
  leads: initialLeads,
  visibleColumns,
  profiles,
  currentUserId,
}: Props) {
  const searchParams = useSearchParams();
  const filters = useMemo(
    () => filtersFromSearchParams(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);

  // ref mirror of leads so optimisticPatch can read the previous snapshot
  // without depending on `leads` (which would invalidate the columns memo
  // every time a row changes).
  const leadsRef = useRef(leads);
  useEffect(() => {
    leadsRef.current = leads;
  }, [leads]);

  // Stable optimistic helper.
  const optimisticPatch = useCallback(
    async (leadId: string, patch: Partial<Lead>, action: () => Promise<void>) => {
      const previous = leadsRef.current;
      setLeads((curr) =>
        curr.map((l) => (l.id === leadId ? { ...l, ...patch } : l)),
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
    [],
  );

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return leads.filter((lead) => {
      if (!filters.show_unqualified && lead.qualified === "unqualified") return false;
      if (filters.owner !== ALL) {
        if (filters.owner === "me") {
          if (lead.owner_id !== currentUserId) return false;
        } else if (filters.owner === "unassigned") {
          if (lead.owner_id !== null) return false;
        } else {
          if (lead.owner_id !== filters.owner) return false;
        }
      }
      if (filters.lead_status !== ALL && lead.lead_status !== filters.lead_status) return false;
      if (filters.email_status !== ALL && lead.email_status !== filters.email_status) return false;
      if (filters.linkedin_stage !== ALL && lead.linkedin_stage !== filters.linkedin_stage) return false;
      if (filters.call_status !== ALL && lead.call_status !== filters.call_status) return false;
      if (!q) return true;
      return (
        lead.name.toLowerCase().includes(q) ||
        lead.email.toLowerCase().includes(q) ||
        (lead.company ?? "").toLowerCase().includes(q)
      );
    });
  }, [leads, filters, currentUserId]);

  const filteredIds = useMemo(() => filtered.map((l) => l.id), [filtered]);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const someFilteredSelected = filteredIds.some((id) => selected.has(id));

  const toggleAllFiltered = useCallback(
    (check: boolean) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (check) filteredIds.forEach((id) => next.add(id));
        else filteredIds.forEach((id) => next.delete(id));
        return next;
      });
    },
    [filteredIds],
  );

  const toggleRow = useCallback((id: string, check: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (check) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const selectionCtx = useMemo<SelectionCtx>(
    () => ({
      isSelected: (id) => selected.has(id),
      toggleRow,
      toggleAllFiltered,
      allFilteredSelected,
      someFilteredSelected,
    }),
    [selected, toggleRow, toggleAllFiltered, allFilteredSelected, someFilteredSelected],
  );

  // ─── Columns ────────────────────────────────────────────────────────────
  // Depends only on stable inputs (leads ref isn't used here; we use `leads`
  // only for the "has any data" probe of fixed leading columns, which is
  // OK because if you add or remove a lead the columns *should* recompute).
  // Crucially: does NOT depend on `selected` anymore — that lives in context.
  const columns = useMemo<ColumnDef<Lead>[]>(() => {
    const cols: ColumnDef<Lead>[] = [];

    cols.push({
      id: "_select",
      enableSorting: false,
      header: () => <HeaderCheckbox />,
      cell: ({ row }) => <RowCheckbox id={row.original.id} />,
    });

    const buildDataColumn = (key: string): ColumnDef<Lead> => ({
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
    });

    const FIXED_LEADING = ["name", "company", "employees", "city"] as const;
    const hasAnyData = (key: string) =>
      leads.some((l) => (getLeadValue(l, key) ?? "").trim() !== "");

    const renderedKeys = new Set<string>();
    for (const key of FIXED_LEADING) {
      if (key === "name" || hasAnyData(key)) {
        cols.push(buildDataColumn(key));
        renderedKeys.add(key);
      }
    }

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
                updateLeadOwner(lead.id, next),
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
                () => updateEmailStatus(lead.id, next),
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
                () => updateLinkedInStage(lead.id, next),
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
                () => updateCallStatus(lead.id, next),
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
                () => updateLeadStatus(lead.id, next),
              )
            }
          />
        );
      },
    });

    cols.push({
      id: "qualified",
      header: "Qualified",
      cell: (info) => {
        const lead = info.row.original;
        return (
          <QualifiedCell
            qualified={lead.qualified}
            reason={lead.unqualified_reason}
            unqualifiedAt={lead.unqualified_at}
            onUnqualify={(reason: UnqualifiedReason) =>
              optimisticPatch(
                lead.id,
                {
                  qualified: "unqualified",
                  unqualified_reason: reason,
                  unqualified_at: new Date().toISOString(),
                },
                () => unqualifyLead(lead.id, reason),
              )
            }
            onRequalify={() =>
              optimisticPatch(
                lead.id,
                {
                  qualified: "qualified",
                  unqualified_reason: null,
                  unqualified_at: null,
                  unqualified_by: null,
                },
                () => requalifyLead(lead.id),
              )
            }
          />
        );
      },
    });

    for (const key of visibleColumns) {
      if (renderedKeys.has(key)) continue;
      cols.push(buildDataColumn(key));
      renderedKeys.add(key);
    }

    return cols;
  }, [leads, visibleColumns, profiles, optimisticPatch]);

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const rows = table.getRowModel().rows;

  // ─── Virtualization ─────────────────────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 44, // matches row height with py-2.5 + content
    overscan: 12,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? totalSize - virtualItems[virtualItems.length - 1].end
      : 0;

  // ─── Bulk actions ───────────────────────────────────────────────────────
  async function bulkAssignOwner(ownerId: string | null) {
    const ids = Array.from(selected);
    const previous = leadsRef.current;
    setLeads((curr) =>
      curr.map((l) => (selected.has(l.id) ? { ...l, owner_id: ownerId } : l)),
    );
    try {
      await bulkUpdateLeadOwner(ids, ownerId);
    } catch (err) {
      setLeads(previous);
      alert(err instanceof Error ? err.message : "Bulk update failed.");
    }
  }

  async function bulkMarkSmartleadSent() {
    const ids = Array.from(selected);
    const previous = leadsRef.current;
    const now = new Date().toISOString();
    setLeads((curr) =>
      curr.map((l) =>
        selected.has(l.id)
          ? { ...l, email_status: "smartlead_sent", email_status_updated_at: now }
          : l,
      ),
    );
    try {
      await bulkUpdateEmailStatus(ids, "smartlead_sent");
    } catch (err) {
      setLeads(previous);
      alert(err instanceof Error ? err.message : "Bulk update failed.");
    }
  }

  async function bulkSetLeadStatus(status: LeadStatus) {
    const ids = Array.from(selected);
    const previous = leadsRef.current;
    const now = new Date().toISOString();
    setLeads((curr) =>
      curr.map((l) =>
        selected.has(l.id)
          ? { ...l, lead_status: status, lead_status_updated_at: now }
          : l,
      ),
    );
    try {
      await bulkUpdateLeadStatus(ids, status);
    } catch (err) {
      setLeads(previous);
      alert(err instanceof Error ? err.message : "Bulk update failed.");
    }
  }

  return (
    <SelectionContext.Provider value={selectionCtx}>
      <div className="space-y-4">
        <BulkActionBar
          selectedCount={selected.size}
          profiles={profiles}
          onClear={() => setSelected(new Set())}
          onAssignOwner={bulkAssignOwner}
          onMarkSmartleadSent={bulkMarkSmartleadSent}
          onSetLeadStatus={bulkSetLeadStatus}
        />

        <FilterBar
          profiles={profiles}
          currentUserId={currentUserId}
          resultCount={filtered.length}
          totalCount={leads.length}
        />

        <div
          ref={scrollRef}
          className="rounded-md border border-[var(--border-subtle)] overflow-auto"
          style={{ maxHeight: "calc(100vh - 260px)" }}
        >
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-[var(--bg-elevated)]">
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
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No leads match your filters.
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {paddingTop > 0 && (
                    <tr style={{ height: `${paddingTop}px` }} aria-hidden>
                      <td colSpan={columns.length} />
                    </tr>
                  )}
                  {virtualItems.map((virtualRow) => {
                    const row = rows[virtualRow.index];
                    return (
                      <TableRow
                        key={row.id}
                        data-index={virtualRow.index}
                        ref={rowVirtualizer.measureElement}
                        className="cursor-pointer hover:bg-[var(--bg-overlay)]"
                        onClick={() => setOpenLeadId(row.original.id)}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <TableCell key={cell.id} className="whitespace-nowrap">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                  {paddingBottom > 0 && (
                    <tr style={{ height: `${paddingBottom}px` }} aria-hidden>
                      <td colSpan={columns.length} />
                    </tr>
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </div>

        <LeadDetailDrawer
          leadId={openLeadId}
          onClose={() => setOpenLeadId(null)}
          onNotesSaved={(id, newNotes) =>
            setLeads((curr) =>
              curr.map((l) => (l.id === id ? { ...l, notes: newNotes } : l)),
            )
          }
        />
      </div>
    </SelectionContext.Provider>
  );
}
