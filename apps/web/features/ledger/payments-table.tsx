"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { EmptyNote } from "@/components/section";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/format";
import type { DecryptedLedgerRow } from "@/lib/types";

const PER_PAGE = 25;

type Props = {
  rows: DecryptedLedgerRow[];
  loading: boolean;
};

export function PaymentsTable({ rows, loading }: Props) {
  const [page, setPage] = useState(1);

  const pageCount = Math.max(1, Math.ceil(rows.length / PER_PAGE));

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * PER_PAGE;
    return rows.slice(start, start + PER_PAGE);
  }, [rows, page]);

  if (loading && rows.length === 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyNote>
        No payments on record. Import a statement and every real charge lands here — one row per
        payment.
      </EmptyNote>
    );
  }

  const firstIndex = (page - 1) * PER_PAGE + 1;
  const lastIndex = Math.min(page * PER_PAGE, rows.length);

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 text-right">#</TableHead>
            <TableHead>Merchant</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageRows.map((row, i) => (
            <TableRow key={row.id}>
              <TableCell className="money text-right text-[11px] text-muted-foreground/70">
                {firstIndex + i}
              </TableCell>
              <TableCell className="max-w-[420px]">
                <div className="font-medium">{row.merchantDisplay}</div>
                {row.merchantMatched ? null : (
                  <div className="truncate font-mono text-[11px] text-muted-foreground">
                    {row.merchantRaw}
                  </div>
                )}
              </TableCell>
              <TableCell className="money whitespace-nowrap text-right text-[14px]">
                ${formatMoney(row.amount)}
              </TableCell>
              <TableCell className="money whitespace-nowrap text-right text-muted-foreground">
                {formatDate(row.date)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {firstIndex}–{lastIndex} of {rows.length} · page {page}/{pageCount}
        </p>
        <div className="flex gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
