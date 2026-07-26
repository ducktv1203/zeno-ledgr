"use client";

import { useRef, useState } from "react";
import { FileUp, Loader2, ShieldCheck } from "lucide-react";

import { ErrorNote } from "@/components/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/format";
import { parseStatementFile, type ParsedStatementRow } from "@/lib/parse-statement";

const PREVIEW_ROWS = 8;
const ACCEPT = ".pdf,application/pdf,image/*,.png,.jpg,.jpeg,.webp,.csv,text/csv";

type PendingMeta = {
  filename: string;
  pageCount?: number;
};

type Props = {
  onImport: (
    rows: ParsedStatementRow[],
    meta: { filename: string; pageCount?: number | null },
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

  function reset() {
    setPendingRows([]);
    setPendingMeta(null);
    setWarnings([]);
    setError(null);
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
      setPendingMeta({ filename: file.name, pageCount: parsed.pageCount });
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
        { filename: pendingMeta.filename, pageCount: pendingMeta.pageCount ?? null },
        (done, total) => setProgress({ done, total }),
      );
      reset();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Import failed partway — refresh and retry",
      );
    } finally {
      setImporting(false);
      setProgress(null);
    }
  }

  const busy = parsing || importing;

  return (
    <div className="space-y-5">
      <div className="ledger-rules rounded border border-dashed border-input bg-background/40 p-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[260px] flex-1 space-y-2">
            <Label htmlFor="statement-file">Statement file</Label>
            <Input
              id="statement-file"
              ref={fileInputRef}
              type="file"
              accept={ACCEPT}
              disabled={busy}
              onChange={(e) => void readFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            PDF, photo or CSV.{" "}
            <a className="link-underline" href="/samples/sample-statement.pdf" download>
              Try a sample
            </a>
          </p>
        </div>

        {parsing ? (
          <p className="mt-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {parseStatus ?? "Reading…"}
          </p>
        ) : null}
      </div>

      {warnings.map((warning) => (
        <p key={warning} className="text-[12.5px] leading-relaxed text-muted-foreground">
          {warning}
        </p>
      ))}

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      {pendingRows.length > 0 ? (
        <div className="panel-flush space-y-4 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[13px]">
              <span className="figure text-xl">{pendingRows.length}</span> payment
              {pendingRows.length === 1 ? "" : "s"} ready from{" "}
              <span className="font-medium">{pendingMeta?.filename}</span>
            </p>
            <p className="eyebrow">
              Preview · first {Math.min(PREVIEW_ROWS, pendingRows.length)}
            </p>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Merchant</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingRows.slice(0, PREVIEW_ROWS).map((row) => (
                <TableRow key={`${row.line}-${row.merchantRaw}-${row.date}`}>
                  <TableCell className="max-w-[320px] truncate font-mono text-[11.5px] text-muted-foreground">
                    {row.merchantRaw}
                  </TableCell>
                  <TableCell className="money text-right">${formatMoney(row.amount)}</TableCell>
                  <TableCell className="money text-right text-muted-foreground">
                    {formatDate(row.date)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" disabled={busy} onClick={() => void commit()}>
              <ShieldCheck className="h-4 w-4" />
              {importing
                ? `Encrypting ${progress?.done ?? 0} of ${progress?.total ?? pendingRows.length}…`
                : `Encrypt and import ${pendingRows.length}`}
            </Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={reset}>
              Discard
            </Button>
            {importing && progress ? (
              <div className="h-[3px] w-32 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full bg-oxblood transition-all duration-200"
                  style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-muted-foreground">
          <FileUp className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Text PDFs parse instantly. Scans and photos run OCR on this device, then every row is
          encrypted before it is sent. Bank footers, notices and $0 lines are discarded.
        </p>
      )}
    </div>
  );
}
