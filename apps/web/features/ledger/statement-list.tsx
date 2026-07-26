"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import { EmptyNote, ErrorNote } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTimestamp } from "@/lib/format";
import type { StatementRow } from "@/lib/types";

type Props = {
  statements: StatementRow[];
  activeStatementId: string | null;
  onOpen: (statementId: string) => void;
  onClearFilter: () => void;
  onDelete: (statementId: string) => Promise<void>;
};

export function StatementList({
  statements,
  activeStatementId,
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

  if (statements.length === 0) {
    return (
      <EmptyNote>
        No statements yet. Import a bank PDF, a photo of a statement, or a CSV below and it will be
        filed here.
      </EmptyNote>
    );
  }

  return (
    <div className="space-y-4">
      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>File</TableHead>
            <TableHead className="text-right">Payments</TableHead>
            <TableHead className="text-right">Pages</TableHead>
            <TableHead>Imported</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {statements.map((statement) => {
            const open = activeStatementId === statement.id;
            return (
              <TableRow key={statement.id} data-state={open ? "selected" : undefined}>
                <TableCell className="max-w-[280px]">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{statement.filename}</span>
                    {open ? <Badge variant="ochre">Viewing</Badge> : null}
                  </div>
                </TableCell>
                <TableCell className="money text-right">{statement.payment_count}</TableCell>
                <TableCell className="money text-right text-muted-foreground">
                  {statement.page_count ?? "—"}
                </TableCell>
                <TableCell className="text-[12.5px] text-muted-foreground">
                  {formatTimestamp(statement.created_at)}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1.5">
                    <Button
                      type="button"
                      size="sm"
                      variant={open ? "secondary" : "outline"}
                      onClick={() => (open ? onClearFilter() : onOpen(statement.id))}
                    >
                      {open ? "Show all" : "Open"}
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
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
