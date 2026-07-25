"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  expectedDatesInRange,
  todayIso,
  type DetectedSubscription,
} from "@/lib/detect-subscriptions";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const ACCENTS = [
  "bg-sky-500/25 text-sky-100 ring-sky-500/40",
  "bg-emerald-500/25 text-emerald-100 ring-emerald-500/40",
  "bg-amber-500/25 text-amber-100 ring-amber-500/40",
  "bg-rose-500/25 text-rose-100 ring-rose-500/40",
  "bg-teal-500/25 text-teal-100 ring-teal-500/40",
  "bg-indigo-500/25 text-indigo-100 ring-indigo-500/40",
];

type DayEvent = {
  service: string;
  amount: string;
  accent: string;
};

type Props = {
  subscriptions: DetectedSubscription[];
  onSelectService?: (service: string) => void;
};

function monthBounds(year: number, monthIndex: number): { start: string; end: string } {
  const start = new Date(Date.UTC(year, monthIndex, 1));
  const end = new Date(Date.UTC(year, monthIndex + 1, 0));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function buildGrid(year: number, monthIndex: number): (string | null)[] {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  // JS: 0=Sun … convert to Mon=0
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < mondayOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(new Date(Date.UTC(year, monthIndex, d)).toISOString().slice(0, 10));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function SubscriptionCalendar({ subscriptions, onSelectService }: Props) {
  const today = todayIso();
  const initial = new Date(`${today}T00:00:00Z`);
  const [cursor, setCursor] = useState({
    year: initial.getUTCFullYear(),
    month: initial.getUTCMonth(),
  });

  const accentByService = useMemo(() => {
    const map = new Map<string, string>();
    subscriptions.forEach((s, i) => {
      map.set(s.service, ACCENTS[i % ACCENTS.length]!);
    });
    return map;
  }, [subscriptions]);

  const eventsByDay = useMemo(() => {
    const { start, end } = monthBounds(cursor.year, cursor.month);
    const map = new Map<string, DayEvent[]>();
    for (const sub of subscriptions) {
      const dates = expectedDatesInRange(sub, start, end);
      const accent = accentByService.get(sub.service) ?? ACCENTS[0]!;
      for (const date of dates) {
        const list = map.get(date) ?? [];
        list.push({ service: sub.service, amount: sub.amount, accent });
        map.set(date, list);
      }
    }
    return map;
  }, [subscriptions, cursor, accentByService]);

  const cells = useMemo(() => buildGrid(cursor.year, cursor.month), [cursor]);

  const title = new Date(Date.UTC(cursor.year, cursor.month, 1)).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const monthDueTotal = useMemo(() => {
    let sum = 0;
    for (const events of eventsByDay.values()) {
      for (const e of events) sum += Number.parseFloat(e.amount) || 0;
    }
    return sum;
  }, [eventsByDay]);

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const d = new Date(Date.UTC(c.year, c.month + delta, 1));
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
    });
  }

  if (subscriptions.length === 0) return null;

  return (
    <div className="border-border space-y-4 rounded-xl border bg-gradient-to-b from-white/[0.03] to-transparent p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium tracking-tight">{title}</p>
          <p className="text-muted-foreground text-xs">
            Recurring dues this month · ~${monthDueTotal.toFixed(2)}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label="Previous month"
            onClick={() => shiftMonth(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() =>
              setCursor({
                year: initial.getUTCFullYear(),
                month: initial.getUTCMonth(),
              })
            }
          >
            Today
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-label="Next month"
            onClick={() => shiftMonth(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="text-muted-foreground pb-1 text-center text-[10px] font-medium uppercase tracking-[0.14em]"
          >
            {d}
          </div>
        ))}
        {cells.map((iso, idx) => {
          if (!iso) {
            return <div key={`empty-${idx}`} className="min-h-[4.5rem] rounded-lg" />;
          }
          const dayNum = Number(iso.slice(8, 10));
          const events = eventsByDay.get(iso) ?? [];
          const isToday = iso === today;
          return (
            <div
              key={iso}
              className={`min-h-[4.5rem] rounded-lg border p-1.5 transition-colors ${
                isToday
                  ? "border-sky-500/50 bg-sky-500/10"
                  : events.length
                    ? "border-border/80 bg-muted/20"
                    : "border-transparent bg-muted/10"
              }`}
            >
              <div
                className={`mb-1 text-[11px] tabular-nums ${
                  isToday ? "font-semibold text-sky-100" : "text-muted-foreground"
                }`}
              >
                {dayNum}
              </div>
              <div className="flex flex-col gap-0.5">
                {events.slice(0, 3).map((e) => (
                  <button
                    key={`${iso}-${e.service}`}
                    type="button"
                    title={`${e.service} · $${e.amount}`}
                    className={`truncate rounded px-1 py-0.5 text-left text-[10px] leading-tight ring-1 ring-inset ${e.accent}`}
                    onClick={() => onSelectService?.(e.service)}
                  >
                    {e.service}
                  </button>
                ))}
                {events.length > 3 ? (
                  <span className="text-muted-foreground px-1 text-[10px]">
                    +{events.length - 3}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {subscriptions.map((s) => (
          <button
            key={s.service}
            type="button"
            className={`rounded-full px-2.5 py-1 text-[11px] ring-1 ring-inset ${
              accentByService.get(s.service) ?? ACCENTS[0]
            }`}
            onClick={() => onSelectService?.(s.service)}
          >
            {s.service} · ${s.amount}
          </button>
        ))}
      </div>
    </div>
  );
}
