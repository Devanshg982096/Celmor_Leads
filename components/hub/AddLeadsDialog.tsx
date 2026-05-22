"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { normaliseRow } from "@/lib/apollo-mapping";
import {
  appendLeadsToAvatar,
  checkDuplicateEmails,
  type NewLeadInput,
} from "@/lib/avatars/actions";

interface ParsedState {
  fileName: string;
  leads: NewLeadInput[];
  rowCount: number;
  duplicateInfo: {
    totalDuplicates: number;
    perAvatar: { avatarId: string; avatarName: string; count: number }[];
  } | null;
}

export default function AddLeadsDialog({ avatarId }: { avatarId: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [parsed, setParsed] = useState<ParsedState | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setParsed(null);
    setParseError(null);
    setSubmitError(null);
  }

  function handleFile(file: File) {
    setParseError(null);
    setParsing(true);

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (result) => {
        try {
          const rawRows = result.data;
          if (!rawRows || rawRows.length === 0) {
            setParseError("That CSV appears to be empty.");
            setParsing(false);
            return;
          }

          const rows = rawRows.map((r) => normaliseRow(r));
          const hasEmail = rows.some((r) => (r.email ?? "").trim() !== "");
          if (!hasEmail) {
            setParseError(
              "We couldn't find an Email column in this CSV.",
            );
            setParsing(false);
            return;
          }

          const emails = rows
            .map((r) => (r.email ?? "").trim().toLowerCase())
            .filter(Boolean);
          const dup = await checkDuplicateEmails(emails);

          const leads: NewLeadInput[] = rows
            .filter((r) => (r.email ?? "").trim() !== "")
            .map((r) => ({
              name: (r.name ?? "").trim() || (r.email ?? "").trim(),
              email: (r.email ?? "").trim().toLowerCase(),
              company: r.company?.trim() || null,
              title: r.title?.trim() || null,
              linkedin_url: r.linkedin_url?.trim() || null,
              phone:
                r.phone?.trim() ||
                r.mobile_phone?.trim() ||
                r.company_phone?.trim() ||
                null,
              raw_data: r,
            }));

          setParsed({
            fileName: file.name,
            leads,
            rowCount: rows.length,
            duplicateInfo: dup,
          });
          setParsing(false);
        } catch (err) {
          setParseError(
            err instanceof Error ? err.message : "Failed to parse CSV.",
          );
          setParsing(false);
        }
      },
      error: (err) => {
        setParseError(err.message);
        setParsing(false);
      },
    });
  }

  function handleSubmit() {
    if (!parsed) return;
    setSubmitError(null);
    startTransition(async () => {
      try {
        await appendLeadsToAvatar({ avatarId, leads: parsed.leads });
        setOpen(false);
        reset();
        router.refresh();
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Append failed.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger
        className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-overlay)] hover:text-[var(--text-primary)]"
      >
        <Upload className="size-4" />
        Add leads
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add leads to this Avatar</DialogTitle>
          <DialogDescription>
            Upload another Apollo CSV — its leads will be appended to this
            Avatar.
          </DialogDescription>
        </DialogHeader>

        {!parsed && (
          <div className="rounded-md border border-dashed border-[var(--border-default)] p-6 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={parsing}
            >
              {parsing ? "Parsing…" : "Choose CSV file"}
            </Button>
            <p className="mt-2 text-[11.5px] text-[var(--text-tertiary)]">
              Same Apollo field mapping as the original import
            </p>
            {parseError && (
              <p className="mt-3 text-sm text-[var(--status-danger)]">
                {parseError}
              </p>
            )}
          </div>
        )}

        {parsed && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[var(--text-tertiary)] text-xs">File</p>
                <p className="truncate font-medium">{parsed.fileName}</p>
              </div>
              <Badge variant="neutral">
                {parsed.leads.length.toLocaleString("en-GB")} leads
              </Badge>
            </div>

            {parsed.duplicateInfo &&
              parsed.duplicateInfo.totalDuplicates > 0 && (
                <div className="rounded-md border border-[var(--status-warning)]/40 bg-[var(--status-warning-bg)] p-3 text-[12.5px]">
                  <p className="font-medium text-[var(--status-warning)]">
                    ⚠️{" "}
                    {parsed.duplicateInfo.totalDuplicates.toLocaleString("en-GB")}{" "}
                    of these leads already exist in:
                  </p>
                  <ul className="mt-1 ml-5 list-disc text-[var(--text-secondary)]">
                    {parsed.duplicateInfo.perAvatar.map((p) => (
                      <li key={p.avatarId}>
                        {p.avatarName}: {p.count.toLocaleString("en-GB")}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-[11px] text-[var(--text-tertiary)]">
                    Duplicates will still be appended — clean up later if
                    needed.
                  </p>
                </div>
              )}

            {submitError && (
              <p className="text-[var(--status-danger)] text-xs">
                {submitError}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          {parsed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              disabled={isPending}
            >
              Choose different file
            </Button>
          )}
          <DialogClose
            render={
              <Button variant="ghost" size="sm" type="button" disabled={isPending}>
                Cancel
              </Button>
            }
          />
          {parsed && (
            <Button size="sm" onClick={handleSubmit} disabled={isPending}>
              {isPending
                ? "Appending…"
                : `Append ${parsed.leads.length.toLocaleString("en-GB")} leads`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
