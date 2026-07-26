"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { EmptyNote } from "@/components/section";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney, formatCount } from "@/lib/format";
import {
  buildSpendBreakdown,
  type CategorySlice,
} from "@/lib/spend-categories";
import type { DecryptedLedgerRow } from "@/lib/types";
import { useTheme } from "@/lib/use-theme";
import { cn } from "@/lib/utils";

const TOP_MERCHANTS = 8;
const ROW_HEIGHT = 34;
const LABEL_MAX_CHARS = 22;

function truncateLabel(value: string): string {
  return value.length > LABEL_MAX_CHARS
    ? `${value.slice(0, LABEL_MAX_CHARS - 1).trimEnd()}…`
    : value;
}

/*
 * Recharts writes these straight into SVG presentation attributes, where
 * `var()` never resolves — so each theme's colours are inlined and picked at
 * render time instead of read from CSS custom properties.
 */
const PALETTE = {
  light: {
    barLead: "hsl(4, 65%, 38%)",
    barRest: "hsl(30, 13%, 9%)",
    barRestOpacity: 0.26,
    axisText: "hsl(33, 10%, 38%)",
    cursor: "hsl(40, 30%, 87%)",
    track: "hsl(36, 18%, 90%)",
  },
  dark: {
    barLead: "hsl(6, 66%, 57%)",
    barRest: "hsl(40, 28%, 91%)",
    barRestOpacity: 0.24,
    axisText: "hsl(36, 9%, 60%)",
    cursor: "hsl(30, 9%, 18%)",
    track: "hsl(30, 9%, 18%)",
  },
} as const;

type Props = {
  rows: DecryptedLedgerRow[];
  loading: boolean;
};

type MerchantSlice = { name: string; total: number; count: number };
type ViewMode = "categories" | "merchants";

/** Where the money goes — by life category, or by merchant. */
export function SpendChart({ rows, loading }: Props) {
  const { theme } = useTheme();
  const palette = PALETTE[theme];
  const [mode, setMode] = useState<ViewMode>("categories");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const breakdown = useMemo(() => buildSpendBreakdown(rows), [rows]);

  const spendSlices = useMemo(
    () => breakdown.slices.filter((s) => s.kind === "spend"),
    [breakdown.slices],
  );

  const otherSlices = useMemo(
    () => breakdown.slices.filter((s) => s.kind !== "spend"),
    [breakdown.slices],
  );

  const selected = useMemo(
    () => spendSlices.find((s) => s.id === activeCategory) ?? null,
    [spendSlices, activeCategory],
  );

  const merchantData = useMemo<MerchantSlice[]>(() => {
    const byMerchant = new Map<string, MerchantSlice>();
    for (const row of rows) {
      const amount = Number.parseFloat(row.amount);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      // Keep the merchant chart focused on outflow — income skews the top.
      const hay = `${row.merchantDisplay} ${row.merchantRaw}`;
      if (/\b(direct\s*credit|salary|wage|payroll)\b/i.test(hay)) continue;
      const name = row.merchantDisplay || row.merchantRaw;
      const existing = byMerchant.get(name);
      if (existing) {
        existing.total += amount;
        existing.count += 1;
      } else {
        byMerchant.set(name, { name, total: amount, count: 1 });
      }
    }
    return [...byMerchant.values()].sort((a, b) => b.total - a.total).slice(0, TOP_MERCHANTS);
  }, [rows]);

  if (loading) {
    return <Skeleton className="h-[320px] w-full" />;
  }

  if (rows.length === 0 || (spendSlices.length === 0 && merchantData.length === 0)) {
    return (
      <EmptyNote>
        Nothing to chart yet. Import a statement and spending will split into groceries,
        transport, entertainment and the rest.
      </EmptyNote>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="figure text-[1.65rem] leading-none text-oxblood">
            ${formatMoney(breakdown.spendTotal)}
          </p>
          <p className="text-[12.5px] text-muted-foreground">
            spent across {formatCount(spendSlices.length)} categor
            {spendSlices.length === 1 ? "y" : "ies"} · {formatCount(breakdown.spendCount)}{" "}
            charge{breakdown.spendCount === 1 ? "" : "s"}
            {breakdown.incomeTotal > 0
              ? ` · $${formatMoney(breakdown.incomeTotal)} income`
              : ""}
          </p>
        </div>

        <div
          className="inline-flex border border-border p-0.5 text-[11.5px] uppercase tracking-[0.12em]"
          role="tablist"
          aria-label="Analysis view"
        >
          {(
            [
              ["categories", "Categories"],
              ["merchants", "Merchants"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={mode === id}
              className={cn(
                "px-3 py-1.5 transition-colors",
                mode === id
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => {
                setMode(id);
                if (id === "merchants") setActiveCategory(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === "categories" ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <CategoryList
            slices={spendSlices}
            palette={palette}
            activeId={activeCategory}
            onSelect={(id) => setActiveCategory((cur) => (cur === id ? null : id))}
          />
          <CategoryDetail
            selected={selected}
            other={otherSlices}
            emptyHint="Select a category to see which merchants make it up."
          />
        </div>
      ) : (
        <MerchantBars data={merchantData} palette={palette} />
      )}
    </div>
  );
}

function CategoryList({
  slices,
  palette,
  activeId,
  onSelect,
}: {
  slices: CategorySlice[];
  palette: (typeof PALETTE)["light"];
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  if (slices.length === 0) {
    return (
      <EmptyNote>No outflow categories in the rows currently in view.</EmptyNote>
    );
  }

  return (
    <ul className="divide-y divide-border border-y border-border">
      {slices.map((slice, index) => {
        const active = slice.id === activeId;
        const pct = Math.round(slice.share * 100);
        return (
          <li key={slice.id}>
            <button
              type="button"
              onClick={() => onSelect(slice.id)}
              className={cn(
                "flex w-full flex-col gap-2 px-0 py-3.5 text-left transition-colors",
                active ? "bg-foreground/[0.03]" : "hover:bg-foreground/[0.02]",
              )}
            >
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium leading-tight">{slice.label}</p>
                  <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                    {slice.hint} · {slice.count} charge{slice.count === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="money text-[13px]">${formatMoney(slice.total)}</p>
                  <p className="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground">
                    {pct}%
                  </p>
                </div>
              </div>
              <div
                className="h-1.5 w-full overflow-hidden"
                style={{ background: palette.track }}
                aria-hidden
              >
                <div
                  className="h-full transition-[width] duration-300"
                  style={{
                    width: `${Math.max(pct, pct > 0 ? 2 : 0)}%`,
                    background: index === 0 || active ? palette.barLead : palette.barRest,
                    opacity: index === 0 || active ? 1 : palette.barRestOpacity + 0.35,
                  }}
                />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function CategoryDetail({
  selected,
  other,
  emptyHint,
}: {
  selected: CategorySlice | null;
  other: CategorySlice[];
  emptyHint: string;
}) {
  return (
    <div className="space-y-5 lg:border-l lg:border-border lg:pl-6">
      {selected ? (
        <div className="space-y-3">
          <div>
            <p className="eyebrow">{selected.label}</p>
            <p className="mt-1.5 figure text-[1.35rem] leading-none">
              ${formatMoney(selected.total)}
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {Math.round(selected.share * 100)}% of spend · top merchants below
            </p>
          </div>
          <ul className="divide-y divide-border border-y border-border">
            {selected.merchants.map((m) => (
              <li
                key={m.name}
                className="flex items-baseline justify-between gap-3 py-2.5 text-[13px]"
              >
                <span className="min-w-0 truncate">{m.name}</span>
                <span className="money shrink-0 text-muted-foreground">
                  ${formatMoney(m.total)}
                  <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.08em]">
                    ×{m.count}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-[13px] leading-relaxed text-muted-foreground">{emptyHint}</p>
      )}

      {other.length > 0 ? (
        <div className="space-y-2">
          <p className="eyebrow">Not counted as spend</p>
          <ul className="space-y-2">
            {other.map((slice) => (
              <li
                key={slice.id}
                className="flex items-baseline justify-between gap-3 text-[13px]"
              >
                <span>
                  {slice.label}
                  <span className="ml-2 text-[11.5px] text-muted-foreground">{slice.hint}</span>
                </span>
                <span className="money text-muted-foreground">${formatMoney(slice.total)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function MerchantBars({
  data,
  palette,
}: {
  data: MerchantSlice[];
  palette: (typeof PALETTE)["light"];
}) {
  if (data.length === 0) {
    return <EmptyNote>No merchant spend in the rows currently in view.</EmptyNote>;
  }

  return (
    <div className="w-full" style={{ height: data.length * ROW_HEIGHT + 16 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 64, bottom: 4, left: 0 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={168}
            tickLine={false}
            axisLine={false}
            interval={0}
            tickFormatter={truncateLabel}
            tick={{ fontSize: 12, fill: palette.axisText }}
          />
          <Tooltip
            cursor={{ fill: palette.cursor, fillOpacity: 0.55 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const slice = payload[0]!.payload as MerchantSlice;
              return (
                <div className="panel px-3 py-2 text-[12px]">
                  <p className="font-medium">{slice.name}</p>
                  <p className="money text-muted-foreground">
                    ${formatMoney(slice.total)} · {slice.count} charge
                    {slice.count === 1 ? "" : "s"}
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="total" radius={[0, 2, 2, 0]} barSize={16} isAnimationActive={false}>
            {data.map((slice, i) => (
              <Cell
                key={slice.name}
                fill={i === 0 ? palette.barLead : palette.barRest}
                fillOpacity={i === 0 ? 1 : palette.barRestOpacity}
              />
            ))}
            <LabelList
              dataKey="total"
              position="right"
              offset={8}
              fill={palette.axisText}
              fontSize={11}
              fontFamily="var(--font-mono)"
              formatter={(value: number) => `$${formatMoney(value)}`}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
