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
  X,
} from "lucide-react";

import { EmptyNote } from "@/components/section";
import { Button } from "@/components/ui/button";
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
import {
  usePreferences,
  type PaymentsPageSize as PageSize,
  type PaymentsView as ViewMode,
} from "@/lib/preferences";
import type { DecryptedLedgerRow } from "@/lib/types";
import { cn } from "@/lib/utils";

type SortKey = "date" | "amount" | "merchant";
type SortDirection = "asc" | "desc";

const PAGE_SIZES: { value: PageSize; label: string }[] = [
  { value: "25", label: "25" },
  { value: "50", label: "50" },
  { value: "100", label: "100" },
  { value: "all", label: "All" },
];

type Filters = {
  minAmount: string;
  maxAmount: string;
  from: string;
  to: string;
};

const NO_FILTERS: Filters = { minAmount: "", maxAmount: "", from: "", to: "" };

type Props = {
  rows: DecryptedLedgerRow[];
  loading: boolean;
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

export function PaymentsTable({ rows, loading }: Props) {
  const { preferences } = usePreferences();
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [viewOverride, setViewOverride] = useState<ViewMode | null>(null);
  const [pageSizeOverride, setPageSizeOverride] = useState<PageSize | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [page, setPage] = useState(1);

  // Settings choose the starting view; the toolbar overrides it for this visit.
  const view = viewOverride ?? preferences.paymentsView;
  const pageSize = pageSizeOverride ?? preferences.paymentsPageSize;

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

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
      return true;
    });
  }, [rows, query, filters]);

  const sorted = useMemo(() => {
    const direction = sortDirection === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const primary = compareRows(a, b, sortKey) * direction;
      // Stable tiebreak so equal amounts/merchants stay in date order.
      return primary !== 0 ? primary : b.date.localeCompare(a.date);
    });
  }, [filtered, sortKey, sortDirection]);

  const perPage = pageSize === "all" ? Math.max(sorted.length, 1) : Number.parseInt(pageSize, 10);
  const pageCount = Math.max(1, Math.ceil(sorted.length / perPage));

  useEffect(() => {
    setPage(1);
  }, [query, filters, pageSize, sortKey, sortDirection]);

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount]);

  const firstIndex = (page - 1) * perPage;
  const pageRows = useMemo(
    () => sorted.slice(firstIndex, firstIndex + perPage),
    [sorted, firstIndex, perPage],
  );

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection(key === "merchant" ? "asc" : "desc");
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
            <li key={row.id} className="flex items-baseline justify-between gap-4 py-3">
              <div className="min-w-0">
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
              <TableHead className="w-10 text-right">#</TableHead>
              <SortableHead
                label="Merchant"
                sortKey="merchant"
                activeKey={sortKey}
                direction={sortDirection}
                onSort={toggleSort}
              />
              <SortableHead
                label="Amount"
                sortKey="amount"
                activeKey={sortKey}
                direction={sortDirection}
                onSort={toggleSort}
                align="right"
              />
              <SortableHead
                label="Date"
                sortKey="date"
                activeKey={sortKey}
                direction={sortDirection}
                onSort={toggleSort}
                align="right"
              />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((row, i) => (
              <TableRow key={row.id}>
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
                  {preferences.showRawDescriptors &&
                  !dense &&
                  row.merchantRaw !== row.merchantDisplay ? (
                    <div className="truncate font-mono text-[11px] text-muted-foreground">
                      {row.merchantRaw}
                    </div>
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
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sortKey === activeKey;
  const Arrow = direction === "asc" ? ArrowUp : ArrowDown;

  return (
    <TableHead className={align === "right" ? "text-right" : undefined}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-label={`Sort by ${label}`}
        className={cn(
          "inline-flex items-center gap-1 transition-colors hover:text-foreground",
          align === "right" && "flex-row-reverse",
          active ? "text-foreground" : undefined,
        )}
      >
        {label}
        <Arrow className={cn("h-3 w-3", active ? "opacity-100" : "opacity-0")} />
      </button>
    </TableHead>
  );
}
