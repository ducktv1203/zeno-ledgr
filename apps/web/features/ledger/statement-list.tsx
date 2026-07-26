"use client";

import { useState } from "react";
import { Eye, FileText, Layers, Trash2 } from "lucide-react";

import { EmptyNote, ErrorNote } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCount, formatTimestamp } from "@/lib/format";
import type { StatementRow } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  statements: StatementRow[];
  activeStatementId: string | null;
  manualCount: number;
  onOpen: (statementId: string) => void;
  onClearFilter: () => void;
  onDelete: (statementId: string) => Promise<void>;
};

export function StatementList({
  statements,
  activeStatementId,
  manualCount,
  onOpen,
  onClearFilter,
  onDelete,
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function remove(statement: StatementRow) {
    const confirmed = window.confirm(
      `Delete “${statement.filename}” and all ${statement.payment_count} payments imported from it?`,
    );
    if (!confirmed) return;

    setError(null);
    setDeletingId(statement.id);
    try {
      await onDelete(statement.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete that statement");
    } finally {
      setDeletingId(null);
    }
  }

  const active = statements.find((s) => s.id === activeStatementId) ?? null;
  const totalPayments = statements.reduce((sum, s) => sum + s.payment_count, 0) + manualCount;

  if (statements.length === 0) {
    return (
      <EmptyNote>
        No statements yet. Import a bank PDF, a photo of a statement, or a CSV below and it will be
        filed here.
      </EmptyNote>
    );
  }

  return (
    <div className="space-y-5">
      {error ? <ErrorNote>{error}</ErrorNote> : null}

      {/* What the rest of the page is currently scoped to. */}
      <div className="panel-flush flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-ochre/15 text-oxblood">
            {active ? <FileText className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
          </span>
          <div className="min-w-0">
            <p className="eyebrow">Now viewing</p>
            <p className="mt-1 truncate font-display text-lg leading-snug">
              {active ? active.filename : "All statements combined"}
            </p>
            <p className="money mt-0.5 text-[11.5px] text-muted-foreground">
              {active
                ? `${formatCount(active.payment_count)} payments · imported ${formatTimestamp(active.created_at)}`
                : `${formatCount(totalPayments)} payments across ${formatCount(statements.length)} statement${
                    statements.length === 1 ? "" : "s"
                  }${manualCount ? ` · ${formatCount(manualCount)} manual` : ""}`}
            </p>
          </div>
        </div>

        {active ? (
          <Button type="button" size="sm" variant="outline" onClick={onClearFilter}>
            Show everything
          </Button>
        ) : null}
      </div>

      <ul className="divide-y divide-border border-y border-border">
        {statements.map((statement, i) => {
          const open = statement.id === activeStatementId;
          return (
            <li
              key={statement.id}
              className={cn(
                "flex flex-wrap items-center gap-x-4 gap-y-2 py-3 transition-colors",
                open && "bg-ochre/[0.06]",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-[13.5px] font-medium">{statement.filename}</span>
                  {open ? <Badge variant="ochre">Viewing</Badge> : null}
                  {i === 0 && !open ? <Badge variant="outline">Latest</Badge> : null}
                </div>
                <p className="money mt-1 text-[11.5px] text-muted-foreground">
                  {formatCount(statement.payment_count)} payments
                  {statement.page_count ? ` · ${formatCount(statement.page_count)} pages` : ""} ·{" "}
                  {formatTimestamp(statement.created_at)}
                </p>
              </div>

              <div className="flex shrink-0 gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant={open ? "secondary" : "outline"}
                  onClick={() => (open ? onClearFilter() : onOpen(statement.id))}
                >
                  <Eye className="h-3.5 w-3.5" />
                  {open ? "Showing" : "Open"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={deletingId === statement.id}
                  onClick={() => void remove(statement)}
                  aria-label={`Delete ${statement.filename}`}
                  className="hover:bg-oxblood/10 hover:text-oxblood"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
