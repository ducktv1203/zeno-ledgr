"use client";

import { useMemo } from "react";
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
import { formatMoney } from "@/lib/format";
import type { DecryptedLedgerRow } from "@/lib/types";

const TOP_N = 8;

/*
 * Recharts writes these straight into SVG presentation attributes, where
 * `var()` never resolves — so the theme colours are inlined here.
 */
const BAR_LEAD = "hsl(4, 65%, 38%)";
const BAR_REST = "hsl(30, 13%, 9%)";
const AXIS_TEXT = "hsl(33, 10%, 38%)";
const CURSOR = "hsl(40, 30%, 87%)";

type Props = {
  rows: DecryptedLedgerRow[];
  loading: boolean;
};

type Slice = { name: string; total: number; count: number };

/** Where the money actually goes: spend aggregated per merchant, biggest first. */
export function SpendChart({ rows, loading }: Props) {
  const data = useMemo<Slice[]>(() => {
    const byMerchant = new Map<string, Slice>();
    for (const row of rows) {
      const amount = Number.parseFloat(row.amount);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      const name = row.merchantDisplay || row.merchantRaw;
      const existing = byMerchant.get(name);
      if (existing) {
        existing.total += amount;
        existing.count += 1;
      } else {
        byMerchant.set(name, { name, total: amount, count: 1 });
      }
    }
    return [...byMerchant.values()].sort((a, b) => b.total - a.total).slice(0, TOP_N);
  }, [rows]);

  if (loading) {
    return <Skeleton className="h-[280px] w-full" />;
  }

  if (data.length === 0) {
    return (
      <EmptyNote>
        Nothing to chart yet. Import a statement and your biggest merchants will rank here.
      </EmptyNote>
    );
  }

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 0 }}>
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={132}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: AXIS_TEXT }}
          />
          <Tooltip
            cursor={{ fill: CURSOR, fillOpacity: 0.55 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const slice = payload[0]!.payload as Slice;
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
                fill={i === 0 ? BAR_LEAD : BAR_REST}
                fillOpacity={i === 0 ? 1 : 0.26}
              />
            ))}
            <LabelList
              dataKey="total"
              position="right"
              offset={8}
              fill={AXIS_TEXT}
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
