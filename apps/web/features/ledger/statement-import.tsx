"use client";

import { useRef, useState } from "react";
import {
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  ImageIcon,
  Loader2,
  ScanLine,
  ShieldCheck,
  UploadCloud,
  X,
} from "lucide-react";

import { FlowAmount } from "@/components/flow-amount";
import { ErrorNote } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import wiki from "@/data/merchant-wiki.json";
import { formatPeriod } from "@/lib/detect-subscriptions";
import { formatCount, formatDate, formatMoney } from "@/lib/format";
import { parseStatementFile, type ParsedStatementRow } from "@/lib/parse-statement";
import { refineMerchant } from "@/lib/refiner";
import { inferCashFlow } from "@/lib/spend-categories";
import { cn } from "@/lib/utils";

const PREVIEW_ROWS = 6;
const ACCEPT = ".pdf,application/pdf,image/*,.png,.jpg,.jpeg,.webp,.csv,text/csv";

type PendingMeta = {
  filename: string;
  pageCount?: number;
  usedOcr?: boolean;
  periodStart?: string | null;
  periodEnd?: string | null;
};

type Props = {
  onImport: (
    rows: ParsedStatementRow[],
    meta: {
      filename: string;
      pageCount?: number | null;
      periodStart?: string | null;
      periodEnd?: string | null;
    },
    onProgress: (done: number, total: number) => void,
  ) => Promise<{ statementId: string | null }>;
};

export function StatementImport({ onImport }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingRows, setPendingRows] = useState<ParsedStatementRow[]>([]);
  const [pendingMeta, setPendingMeta] = useState<PendingMeta | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseStatus, setParseStatus] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [showAll, setShowAll] = useState(false);

  function reset() {
    setPendingRows([]);
    setPendingMeta(null);
    setWarnings([]);
    setError(null);
    setShowAll(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function readFile(file: File | null) {
    reset();
    setParseStatus(null);
    if (!file) return;

    setParsing(true);
    try {
      const parsed = await parseStatementFile(file, (p) => setParseStatus(p.message));
      setWarnings(parsed.warnings);
      setPendingRows(parsed.rows);
      setPendingMeta({
        filename: file.name,
        pageCount: parsed.pageCount,
        usedOcr: parsed.usedOcr,
        periodStart: parsed.period?.start ?? null,
        periodEnd: parsed.period?.end ?? null,
      });
      if (parsed.rows.length === 0 && parsed.warnings.length === 0) {
        setError("No transactions found in that file.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read statement");
    } finally {
      setParsing(false);
      setParseStatus(null);
    }
  }

  async function commit() {
    if (pendingRows.length === 0 || !pendingMeta) return;
    setImporting(true);
    setError(null);
    setProgress({ done: 0, total: pendingRows.length });
    try {
      await onImport(
        pendingRows,
        {
          filename: pendingMeta.filename,
          pageCount: pendingMeta.pageCount ?? null,
          periodStart: pendingMeta.periodStart ?? null,
          periodEnd: pendingMeta.periodEnd ?? null,
        },
        (done, total) => setProgress({ done, total }),
      );
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed partway — refresh and retry");
    } finally {
      setImporting(false);
      setProgress(null);
    }
  }

  const busy = parsing || importing;
  const hasPreview = pendingRows.length > 0;
  const visibleRows = showAll ? pendingRows : pendingRows.slice(0, PREVIEW_ROWS);
  const total = pendingRows.reduce((sum, row) => sum + (Number.parseFloat(row.amount) || 0), 0);
  const earliest = pendingRows.reduce<string | null>(
    (min, row) => (min === null || row.date < min ? row.date : min),
    null,
  );
  const percent = progress ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="space-y-5">
      {!hasPreview ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!busy) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (!busy) void readFile(e.dataTransfer.files?.[0] ?? null);
          }}
          className={cn(
            "relative flex flex-col items-center justify-center gap-4 rounded border border-dashed px-6 py-11 text-center transition-colors",
            dragging
              ? "border-oxblood bg-ochre/[0.08]"
              : "border-input bg-background/40 hover:border-foreground/25",
            busy && "pointer-events-none opacity-75",
          )}
        >
          <input
            ref={fileInputRef}
            id="statement-file"
            type="file"
            accept={ACCEPT}
            disabled={busy}
            onChange={(e) => void readFile(e.target.files?.[0] ?? null)}
            className="sr-only"
          />

          {parsing ? (
            <>
              <Loader2 className="h-7 w-7 animate-spin text-oxblood" />
              <div className="space-y-1.5">
                <p className="font-display text-lg">Reading on this device</p>
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  {parseStatus ?? "Working…"}
                </p>
              </div>
            </>
          ) : (
            <>
              <span
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full border border-border bg-card transition-colors",
                  dragging && "border-oxblood text-oxblood",
                )}
              >
                <UploadCloud className="h-5 w-5" />
              </span>

              <div className="space-y-1.5">
                <p className="font-display text-lg leading-snug">
                  Drop a statement here, or{" "}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="link-underline font-display text-oxblood"
                  >
                    browse your files
                  </button>
                </p>
                <p className="mx-auto max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">
                  Parsed and encrypted in this browser. Bank footers, notices and $0 lines never
                  make it in.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <FormatChip icon={<FileText className="h-3 w-3" />} label="PDF" />
                <FormatChip icon={<ImageIcon className="h-3 w-3" />} label="Photo" />
                <FormatChip icon={<FileSpreadsheet className="h-3 w-3" />} label="CSV" />
                <a
                  className="link-underline ml-1 text-[11.5px] text-muted-foreground"
                  href="/samples/sample-statement.pdf"
                  download
                >
                  Try a sample
                </a>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="panel-flush overflow-hidden">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/40 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-oxblood" />
              <span className="truncate text-[13.5px] font-medium">{pendingMeta?.filename}</span>
              {pendingMeta?.usedOcr ? (
                <Badge variant="ochre">
                  <ScanLine className="h-3 w-3" />
                  OCR
                </Badge>
              ) : null}
            </div>
            <button
              type="button"
              onClick={reset}
              disabled={busy}
              aria-label="Discard this file"
              className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <dl className="grid grid-cols-2 divide-x divide-border border-b border-border sm:grid-cols-4">
            <ReadStat label="Payments" value={formatCount(pendingRows.length)} />
            <ReadStat label="Total" value={`$${formatMoney(total)}`} />
            <ReadStat
              label="Period"
              value={
                formatPeriod(pendingMeta?.periodStart ?? null, pendingMeta?.periodEnd ?? null) ??
                (pendingMeta?.pageCount ? `${formatCount(pendingMeta.pageCount)} pages` : "—")
              }
            />
            <ReadStat label="Earliest" value={formatDate(earliest)} />
          </dl>

          <ul className="divide-y divide-border">
            {visibleRows.map((row) => (
              <li
                key={`${row.line}-${row.merchantRaw}-${row.date}`}
                className="flex items-baseline justify-between gap-4 px-4 py-2.5"
              >
                <span className="min-w-0 flex-1 truncate text-[13px]" title={row.merchantRaw}>
                  {refineMerchant(row.merchantRaw, wiki).displayName}
                </span>
                <FlowAmount
                  amount={row.amount}
                  flow={inferCashFlow({
                    merchantRaw: row.merchantRaw,
                    merchantDisplay: refineMerchant(row.merchantRaw, wiki).displayName,
                    flow: row.flow,
                  })}
                  className="shrink-0 text-[13px]"
                />
                <span className="money w-[92px] shrink-0 text-right text-[12px] text-muted-foreground">
                  {formatDate(row.date)}
                </span>
              </li>
            ))}
          </ul>

          {pendingRows.length > PREVIEW_ROWS ? (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="w-full border-t border-border py-2.5 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
            >
              {showAll
                ? "Collapse"
                : `Show all ${formatCount(pendingRows.length)} rows`}
            </button>
          ) : null}

          <div className="space-y-3 border-t border-border px-4 py-3.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <Button type="button" disabled={busy} onClick={() => void commit()}>
                <ShieldCheck className="h-4 w-4" />
                {importing
                  ? `Encrypting ${progress?.done ?? 0} of ${progress?.total ?? pendingRows.length}…`
                  : `Encrypt and import ${formatCount(pendingRows.length)}`}
              </Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={reset}>
                Discard
              </Button>
            </div>

            {importing && progress ? (
              <div
                role="progressbar"
                aria-valuenow={percent}
                aria-valuemin={0}
                aria-valuemax={100}
                className="h-[3px] w-full overflow-hidden rounded-full bg-border"
              >
                <div
                  className="h-full bg-oxblood transition-all duration-200"
                  style={{ width: `${percent}%` }}
                />
              </div>
            ) : null}
          </div>
        </div>
      )}

      {warnings.map((warning) => (
        <p key={warning} className="text-[12.5px] leading-relaxed text-muted-foreground">
          {warning}
        </p>
      ))}

      {error ? <ErrorNote>{error}</ErrorNote> : null}
    </div>
  );
}

function FormatChip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-card px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
      {icon}
      {label}
    </span>
  );
}

function ReadStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <dt className="eyebrow">{label}</dt>
      <dd className="figure mt-1 text-lg">{value}</dd>
    </div>
  );
}
