"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ListFilter,
  Rows2,
  Rows3,
  Search,
  Table2,
  Trash2,
  X,
} from "lucide-react";

import { EmptyNote } from "@/components/section";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCount, formatDate, formatMoney } from "@/lib/format";
import { cleanMerchantLabel } from "@/lib/merchant-label";
import {
  usePreferences,
  type PaymentsPageSize as PageSize,
  type PaymentsView as ViewMode,
} from "@/lib/preferences";
import type { DecryptedLedgerRow } from "@/lib/types";
import { cn } from "@/lib/utils";

type SortKey = "date" | "amount" | "merchant";
type SortDirection = "asc" | "desc";
/** `null` means statement order — newest first, exactly as imported. */
type Sort = { key: SortKey; direction: SortDirection } | null;

const SORT_LABELS: Record<SortKey, string> = {
  date: "Date",
  amount: "Amount",
  merchant: "Merchant",
};

/** Names read best A→Z; dates and amounts read best largest-first. */
function firstDirection(key: SortKey): SortDirection {
  return key === "merchant" ? "asc" : "desc";
}

/** Each header cycles: first direction → opposite → off. */
function nextSort(current: Sort, key: SortKey): Sort {
  if (current?.key !== key) return { key, direction: firstDirection(key) };
  if (current.direction === firstDirection(key)) {
    return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return null;
}

const PAGE_SIZES: { value: PageSize; label: string }[] = [
  { value: "25", label: "25" },
  { value: "50", label: "50" },
  { value: "100", label: "100" },
  { value: "all", label: "All" },
];

/** Where a row came from: a parsed statement, or typed in by hand. */
type Source = "all" | "imported" | "manual";

const SOURCES: { value: Source; label: string }[] = [
  { value: "all", label: "All" },
  { value: "imported", label: "Imported" },
  { value: "manual", label: "Manual" },
];

type Filters = {
  minAmount: string;
  maxAmount: string;
  from: string;
  to: string;
  source: Source;
};

const NO_FILTERS: Filters = {
  minAmount: "",
  maxAmount: "",
  from: "",
  to: "",
  source: "all",
};

type Props = {
  rows: DecryptedLedgerRow[];
  loading: boolean;
  onDelete: (ids: string[]) => Promise<number>;
};

function compareRows(a: DecryptedLedgerRow, b: DecryptedLedgerRow, key: SortKey): number {
  if (key === "amount") {
    return (Number.parseFloat(a.amount) || 0) - (Number.parseFloat(b.amount) || 0);
  }
  if (key === "merchant") {
    return a.merchantDisplay.localeCompare(b.merchantDisplay, "en", { sensitivity: "base" });
  }
  return a.date.localeCompare(b.date);
}

export function PaymentsTable({ rows, loading, onDelete }: Props) {
  const { preferences } = usePreferences();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>(null);
  const [viewOverride, setViewOverride] = useState<ViewMode | null>(null);
  const [pageSizeOverride, setPageSizeOverride] = useState<PageSize | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Settings choose the starting view; the toolbar overrides it for this visit.
  const view = viewOverride ?? preferences.paymentsView;
  const pageSize = pageSizeOverride ?? preferences.paymentsPageSize;

  const activeFilterCount = Object.entries(filters).filter(([key, value]) =>
    key === "source" ? value !== "all" : Boolean(value),
  ).length;

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const min = Number.parseFloat(filters.minAmount);
    const max = Number.parseFloat(filters.maxAmount);

    return rows.filter((row) => {
      if (needle) {
        const haystack = `${row.merchantDisplay} ${row.merchantRaw} ${row.amount} ${row.date}`;
        if (!haystack.toLowerCase().includes(needle)) return false;
      }
      const amount = Number.parseFloat(row.amount);
      if (Number.isFinite(min) && amount < min) return false;
      if (Number.isFinite(max) && amount > max) return false;
      if (filters.from && row.date < filters.from) return false;
      if (filters.to && row.date > filters.to) return false;
      if (filters.source === "manual" && row.statementId) return false;
      if (filters.source === "imported" && !row.statementId) return false;
      return true;
    });
  }, [rows, query, filters]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const direction = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const primary = compareRows(a, b, sort.key) * direction;
      // Stable tiebreak so equal amounts/merchants stay in date order.
      return primary !== 0 ? primary : b.date.localeCompare(a.date);
    });
  }, [filtered, sort]);

  const perPage = pageSize === "all" ? Math.max(sorted.length, 1) : Number.parseInt(pageSize, 10);
  const pageCount = Math.max(1, Math.ceil(sorted.length / perPage));

  useEffect(() => {
    setPage(1);
  }, [query, filters, pageSize, sort]);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  const firstIndex = (page - 1) * perPage;
  const pageRows = useMemo(
    () => sorted.slice(firstIndex, firstIndex + perPage),
    [sorted, firstIndex, perPage],
  );

  function toggleSort(key: SortKey) {
    setSort((current) => nextSort(current, key));
  }

  // Selection is scoped to what the filters currently show, so a delete can
  // never reach a row that has scrolled out from under the user.
  const selectedRows = useMemo(
    () => sorted.filter((row) => selectedIds.has(row.id)),
    [sorted, selectedIds],
  );
  const selectedOnPage = pageRows.filter((row) => selectedIds.has(row.id)).length;

  function toggleRow(id: string, checked: boolean) {
    setConfirmingDelete(false);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function togglePage(checked: boolean) {
    setConfirmingDelete(false);
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const row of pageRows) {
        if (checked) next.add(row.id);
        else next.delete(row.id);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setConfirmingDelete(false);
    setDeleteError(null);
  }

  async function deleteSelected() {
    const ids = selectedRows.map((row) => row.id);
    if (ids.length === 0) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDelete(ids);
      clearSelection();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Could not delete those payments");
    } finally {
      setDeleting(false);
    }
  }

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

  const dense = view === "compact";

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search merchant, amount or date"
              aria-label="Search payments"
              className="h-9 pl-9 pr-8"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          <Button
            type="button"
            variant={filtersOpen || activeFilterCount ? "secondary" : "outline"}
            size="sm"
            className="h-9"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <ListFilter className="h-3.5 w-3.5" />
            Filter
            {activeFilterCount ? (
              <span className="ml-0.5 font-mono text-[10px] text-oxblood">{activeFilterCount}</span>
            ) : null}
          </Button>

          <Segmented
            label="Row density"
            value={view}
            onChange={setViewOverride}
            options={[
              { value: "table", label: <Rows2 className="h-3.5 w-3.5" />, title: "Comfortable" },
              { value: "compact", label: <Rows3 className="h-3.5 w-3.5" />, title: "Compact" },
              { value: "list", label: <Table2 className="h-3.5 w-3.5" />, title: "List" },
            ]}
          />

          <Segmented
            label="Rows per page"
            value={pageSize}
            onChange={setPageSizeOverride}
            options={PAGE_SIZES}
          />
        </div>

        {selectedRows.length > 0 ? (
          <div className="panel-flush flex flex-wrap items-center gap-x-3 gap-y-2 p-2.5">
            <span className="font-mono text-[11px] uppercase tracking-[0.12em]">
              {formatCount(selectedRows.length)} selected
            </span>

            {selectedRows.length < sorted.length ? (
              <button
                type="button"
                onClick={() => setSelectedIds(new Set(sorted.map((row) => row.id)))}
                className="link-underline text-[12px] text-muted-foreground"
              >
                Select all {formatCount(sorted.length)} matching
              </button>
            ) : null}

            <div className="ml-auto flex items-center gap-1.5">
              {confirmingDelete ? (
                <>
                  <span className="text-[12px] text-oxblood">Delete permanently?</span>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={deleting}
                    onClick={deleteSelected}
                  >
                    {deleting ? "Deleting…" : `Yes, delete ${formatCount(selectedRows.length)}`}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={deleting}
                    onClick={() => setConfirmingDelete(false)}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmingDelete(true)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={clearSelection}>
                    Clear
                  </Button>
                </>
              )}
            </div>

            {deleteError ? (
              <p className="w-full text-[12px] text-oxblood">{deleteError}</p>
            ) : null}
          </div>
        ) : null}

        {sort ? (
          <button
            type="button"
            onClick={() => setSort(null)}
            className="inline-flex items-center gap-1.5 self-start rounded-full border border-border bg-secondary/50 py-1 pl-2.5 pr-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
          >
            {SORT_LABELS[sort.key]} {sort.direction === "asc" ? "↑" : "↓"}
            <X className="h-3 w-3" />
            <span className="sr-only">Clear sorting and return to statement order</span>
          </button>
        ) : null}

        {filtersOpen ? (
          <div className="panel-flush grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
            <FilterField
              label="Min amount"
              type="number"
              value={filters.minAmount}
              onChange={(v) => setFilters((f) => ({ ...f, minAmount: v }))}
              placeholder="0.00"
            />
            <FilterField
              label="Max amount"
              type="number"
              value={filters.maxAmount}
              onChange={(v) => setFilters((f) => ({ ...f, maxAmount: v }))}
              placeholder="Any"
            />
            <FilterField
              label="From"
              type="date"
              value={filters.from}
              onChange={(v) => setFilters((f) => ({ ...f, from: v }))}
            />
            <FilterField
              label="To"
              type="date"
              value={filters.to}
              onChange={(v) => setFilters((f) => ({ ...f, to: v }))}
            />
            <div className="space-y-1.5">
              <span className="eyebrow">Source</span>
              <Segmented
                label="Payment source"
                value={filters.source}
                onChange={(source) => setFilters((f) => ({ ...f, source }))}
                options={SOURCES}
              />
            </div>
            {activeFilterCount ? (
              <button
                type="button"
                onClick={() => setFilters(NO_FILTERS)}
                className="link-underline justify-self-start text-[12px] text-muted-foreground sm:col-span-2 lg:col-span-4"
              >
                Clear all filters
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {sorted.length === 0 ? (
        <EmptyNote>
          Nothing matches those terms.{" "}
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setFilters(NO_FILTERS);
            }}
            className="link-underline text-foreground"
          >
            Clear the search and filters
          </button>{" "}
          to see all {formatCount(rows.length)} payments again.
        </EmptyNote>
      ) : view === "list" ? (
        <ul className="divide-y divide-border border-y border-border">
          {pageRows.map((row) => (
            <li key={row.id} className="flex items-baseline gap-3 py-3">
              <Checkbox
                checked={selectedIds.has(row.id)}
                onChange={(e) => toggleRow(row.id, e.target.checked)}
                aria-label={`Select ${row.merchantDisplay}`}
                className="mt-1"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium">{row.merchantDisplay}</p>
                <p className="money mt-0.5 text-[11.5px] text-muted-foreground">
                  {formatDate(row.date)}
                </p>
              </div>
              <span className="money shrink-0 text-[14px]">${formatMoney(row.amount)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <Checkbox
                  checked={pageRows.length > 0 && selectedOnPage === pageRows.length}
                  indeterminate={selectedOnPage > 0 && selectedOnPage < pageRows.length}
                  onChange={(e) => togglePage(e.target.checked)}
                  aria-label="Select every payment on this page"
                />
              </TableHead>
              <TableHead className="w-10 text-right">#</TableHead>
              <SortableHead sortKey="merchant" sort={sort} onSort={toggleSort} />
              <SortableHead sortKey="amount" sort={sort} onSort={toggleSort} align="right" />
              <SortableHead sortKey="date" sort={sort} onSort={toggleSort} align="right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((row, i) => (
              <TableRow key={row.id} data-state={selectedIds.has(row.id) ? "selected" : undefined}>
                <TableCell className={cn(dense && "py-1.5")}>
                  <Checkbox
                    checked={selectedIds.has(row.id)}
                    onChange={(e) => toggleRow(row.id, e.target.checked)}
                    aria-label={`Select ${row.merchantDisplay}`}
                  />
                </TableCell>
                <TableCell
                  className={cn(
                    "money text-right text-[11px] text-muted-foreground/70",
                    dense && "py-1.5",
                  )}
                >
                  {firstIndex + i + 1}
                </TableCell>
                <TableCell className={cn("max-w-[420px]", dense && "py-1.5")}>
                  <div className={cn("truncate font-medium", dense && "text-[12.5px]")}>
                    {row.merchantDisplay}
                  </div>
                  {preferences.showRawDescriptors && !dense ? (
                    <CleanedBankLine raw={row.merchantRaw} display={row.merchantDisplay} />
                  ) : null}
                </TableCell>
                <TableCell
                  className={cn(
                    "money whitespace-nowrap text-right text-[14px]",
                    dense && "py-1.5 text-[12.5px]",
                  )}
                >
                  ${formatMoney(row.amount)}
                </TableCell>
                <TableCell
                  className={cn(
                    "money whitespace-nowrap text-right text-muted-foreground",
                    dense && "py-1.5 text-[12px]",
                  )}
                >
                  {formatDate(row.date)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          {sorted.length === 0
            ? "No matches"
            : `${formatCount(firstIndex + 1)}–${formatCount(
                Math.min(firstIndex + perPage, sorted.length),
              )} of ${formatCount(sorted.length)}`}
          {sorted.length !== rows.length ? ` · filtered from ${formatCount(rows.length)}` : ""}
        </p>

        {pageCount > 1 ? (
          <div className="flex items-center gap-1.5">
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
            <span className="px-1 font-mono text-[11px] tabular-nums text-muted-foreground">
              {page}/{pageCount}
            </span>
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
        ) : null}
      </div>
    </div>
  );
}

function CleanedBankLine({ raw, display }: { raw: string; display: string }) {
  const cleaned = cleanMerchantLabel(raw);
  if (!cleaned || cleaned.toLowerCase() === display.toLowerCase()) return null;
  return (
    <div className="truncate font-mono text-[11px] text-muted-foreground" title={raw}>
      {cleaned}
    </div>
  );
}

function FilterField({
  label,
  value,
  onChange,
  type,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type: "number" | "date";
  placeholder?: string;
}) {
  if (type === "date") {
    return (
      <div className="space-y-1.5">
        <span className="eyebrow">{label}</span>
        <DateField value={value} onChange={onChange} placeholder="Any" />
      </div>
    );
  }

  return (
    <label className="block space-y-1.5">
      <span className="eyebrow">{label}</span>
      <Input
        type="number"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="money h-9 text-[12.5px]"
        step="0.01"
        min="0"
      />
    </label>
  );
}

function SortableHead({
  sortKey,
  sort,
  onSort,
  align = "left",
}: {
  sortKey: SortKey;
  sort: Sort;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  const label = SORT_LABELS[sortKey];
  const active = sort?.key === sortKey;
  const Arrow = active && sort.direction === "asc" ? ArrowUp : ArrowDown;
  const upcoming = nextSort(sort, sortKey);

  return (
    <TableHead
      className={cn("group/head", align === "right" && "text-right")}
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title={
          upcoming
            ? `Sort by ${label.toLowerCase()}, ${
                upcoming.direction === "asc" ? "ascending" : "descending"
              }`
            : "Back to statement order"
        }
        className={cn(
          "inline-flex items-center gap-1 transition-colors hover:text-foreground",
          align === "right" && "flex-row-reverse",
          active && "text-foreground",
        )}
      >
        {label}
        <Arrow
          className={cn(
            "h-3 w-3 transition-opacity",
            active ? "opacity-100" : "opacity-0 group-hover/head:opacity-40",
          )}
        />
      </button>
    </TableHead>
  );
}
