"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  normaliseRow,
  labelFor,
  REQUIRED_VISIBLE_COLUMNS,
} from "@/lib/apollo-mapping";
import {
  checkDuplicateEmails,
  createAvatarAndRedirect,
  type NewLeadInput,
} from "@/lib/avatars/actions";

interface ParsedState {
  fileName: string;
  rows: Record<string, string>[]; // normalised rows
  detectedKeys: string[]; // all unique normalised keys, in stable order
  duplicateInfo: {
    totalDuplicates: number;
    perAvatar: { avatarId: string; avatarName: string; count: number }[];
  } | null;
}

export default function NewAvatarFlow() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedState | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [avatarName, setAvatarName] = useState("");
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleFile(file: File) {
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

          // Normalise headers & values
          const rows = rawRows.map((r) => normaliseRow(r));

          // Stable ordering for detected keys: required first, then by first appearance
          const seen = new Set<string>();
          const ordered: string[] = [];
          for (const req of REQUIRED_VISIBLE_COLUMNS) {
            if (rows.some((r) => req in r)) {
              ordered.push(req);
              seen.add(req);
            }
          }
          for (const row of rows) {
            for (const k of Object.keys(row)) {
              if (!seen.has(k)) {
                ordered.push(k);
                seen.add(k);
              }
            }
          }

          // Validate at least an email column exists
          const hasEmail = rows.some((r) => (r.email ?? "").trim() !== "");
          if (!hasEmail) {
            setParseError(
              "We couldn't find an Email column in this CSV. Apollo exports usually have one called 'Email'."
            );
            setParsing(false);
            return;
          }

          // Run duplicate check
          const emails = rows
            .map((r) => (r.email ?? "").trim().toLowerCase())
            .filter(Boolean);
          const dup = await checkDuplicateEmails(emails);

          // Default visible columns = required + a few sensible Apollo defaults if present
          const defaults = new Set<string>(REQUIRED_VISIBLE_COLUMNS);
          for (const k of ["title", "phone", "industry"]) {
            if (ordered.includes(k)) defaults.add(k);
          }

          setParsed({
            fileName: file.name,
            rows,
            detectedKeys: ordered,
            duplicateInfo: dup,
          });
          setAvatarName(file.name.replace(/\.[^.]+$/, ""));
          setVisibleKeys(defaults);
          setParsing(false);
        } catch (err) {
          setParseError(err instanceof Error ? err.message : "Failed to parse CSV.");
          setParsing(false);
        }
      },
      error: (err) => {
        setParseError(err.message);
        setParsing(false);
      },
    });
  }

  function toggleColumn(key: string, checked: boolean) {
    if ((REQUIRED_VISIBLE_COLUMNS as readonly string[]).includes(key)) return;
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  function handleSubmit() {
    if (!parsed) return;
    if (!avatarName.trim()) {
      setSubmitError("Please give this Avatar a name.");
      return;
    }
    setSubmitError(null);

    const leads: NewLeadInput[] = parsed.rows
      .filter((r) => (r.email ?? "").trim() !== "")
      .map((r) => ({
        name: (r.name ?? "").trim() || (r.email ?? "").trim(),
        email: (r.email ?? "").trim().toLowerCase(),
        company: r.company?.trim() || null,
        title: r.title?.trim() || null,
        linkedin_url: r.linkedin_url?.trim() || null,
        phone: r.phone?.trim() || r.mobile_phone?.trim() || null,
        raw_data: r,
      }));

    startTransition(async () => {
      try {
        await createAvatarAndRedirect({
          name: avatarName.trim(),
          visibleColumns: Array.from(visibleKeys),
          leads,
        });
        router.refresh();
      } catch (err) {
        // Note: redirect() throws an internal error to navigate — that's expected, not a real failure.
        const message = err instanceof Error ? err.message : "Failed to create Avatar.";
        if (!message.includes("NEXT_REDIRECT")) {
          setSubmitError(message);
        }
      }
    });
  }

  if (!parsed) {
    return (
      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-1">Upload Apollo CSV</h2>
            <p className="text-sm text-muted-foreground">
              Drop an Apollo export and we&apos;ll detect the columns automatically.
            </p>
          </div>

          <div className="border border-dashed rounded-lg p-8 text-center">
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
              onClick={() => fileInputRef.current?.click()}
              disabled={parsing}
            >
              {parsing ? "Parsing…" : "Choose CSV file"}
            </Button>
            <p className="text-xs text-muted-foreground mt-3">CSV files only</p>
          </div>

          {parseError && (
            <p className="text-sm text-destructive">{parseError}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">File</p>
              <p className="font-medium">{parsed.fileName}</p>
            </div>
            <Badge variant="secondary">
              {parsed.rows.length.toLocaleString()} rows detected
            </Badge>
          </div>

          {parsed.duplicateInfo && parsed.duplicateInfo.totalDuplicates > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 p-4 text-sm">
              <p className="font-medium text-amber-900 dark:text-amber-200">
                ⚠️ {parsed.duplicateInfo.totalDuplicates.toLocaleString()} of these leads already exist
              </p>
              <ul className="mt-2 ml-5 list-disc text-amber-900/80 dark:text-amber-200/80">
                {parsed.duplicateInfo.perAvatar.map((p) => (
                  <li key={p.avatarId}>
                    {p.avatarName}: {p.count.toLocaleString()}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-amber-900/70 dark:text-amber-200/70">
                Duplicates will still be imported into this new Avatar — you can clean up later.
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="avatar-name">Avatar name</Label>
            <Input
              id="avatar-name"
              value={avatarName}
              onChange={(e) => setAvatarName(e.target.value)}
              disabled={isPending}
              placeholder="e.g. FinTech Accountants"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 space-y-3">
          <div>
            <h3 className="font-semibold">Columns to show in the table</h3>
            <p className="text-sm text-muted-foreground">
              Name, Email, Company and LinkedIn URL are always visible. Everything else is stored in
              the lead&apos;s raw data either way — you&apos;re just picking what shows in the smart table.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {parsed.detectedKeys.map((key) => {
              const required = (REQUIRED_VISIBLE_COLUMNS as readonly string[]).includes(key);
              const checked = required || visibleKeys.has(key);
              return (
                <label
                  key={key}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-accent"
                >
                  <Checkbox
                    checked={checked}
                    disabled={required || isPending}
                    onCheckedChange={(v) => toggleColumn(key, v === true)}
                  />
                  <span className="flex-1">{labelFor(key)}</span>
                  {required && (
                    <Badge variant="outline" className="text-xs">
                      required
                    </Badge>
                  )}
                </label>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {submitError && (
        <p className="text-sm text-destructive">{submitError}</p>
      )}

      <div className="flex items-center justify-between">
        <Link
          href="/"
          className={buttonVariants({ variant: "ghost" })}
          aria-disabled={isPending}
        >
          Cancel
        </Link>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => {
              setParsed(null);
              setAvatarName("");
              setVisibleKeys(new Set());
            }}
            disabled={isPending}
          >
            Choose different file
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending
              ? `Creating Avatar…`
              : `Create Avatar with ${parsed.rows.length.toLocaleString()} leads`}
          </Button>
        </div>
      </div>
    </div>
  );
}
