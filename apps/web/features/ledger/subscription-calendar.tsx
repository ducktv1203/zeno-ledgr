"use client";

import { useMemo, useState } from "react";
import type { Matcher } from "react-day-picker";

import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import {
  expectedDatesInRange,
  type DetectedSubscription,
} from "@/lib/detect-subscriptions";
import { dateToIsoLocal, isoToLocalDate, todayIso } from "@/lib/dates";
import { formatDate, formatDayMonth, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Dots per cell before it collapses to a count — keeps every cell the same height. */
const MAX_DOTS = 3;

type DayEvent = {
  service: string;
  amount: string;
};

type Props = {
  subscriptions: DetectedSubscription[];
  onSelectService?: (service: string) => void;
};

/** Pad the window a week either side so outside days still carry marks. */
function monthWindow(month: Date): { start: string; end: string } {
  const y = month.getFullYear();
  const m = month.getMonth();
  return {
    start: dateToIsoLocal(new Date(y, m, 1 - 7)),
    end: dateToIsoLocal(new Date(y, m + 1, 7)),
  };
}

export function SubscriptionCalendar({ subscriptions, onSelectService }: Props) {
  const today = todayIso();
  const [month, setMonth] = useState(() => isoToLocalDate(today));
  const [selected, setSelected] = useState<Date>(() => isoToLocalDate(today));

  const eventsByDay = useMemo(() => {
    const { start, end } = monthWindow(month);
    const map = new Map<string, DayEvent[]>();

    const push = (iso: string, event: DayEvent) => {
      const list = map.get(iso) ?? [];
      if (list.some((e) => e.service === event.service && e.amount === event.amount)) return;
      list.push(event);
      map.set(iso, list);
    };

    for (const sub of subscriptions) {
      const event = { service: sub.service, amount: sub.amount };
      // Pin the rolled next due so the current cycle is always visible.
      if (sub.nextExpectedDate) push(sub.nextExpectedDate, event);
      for (const date of expectedDatesInRange(sub, start, end)) push(date, event);
    }
    return map;
  }, [subscriptions, month]);

  const dueMatcher: Matcher = useMemo(
    () => [...eventsByDay.keys()].map((iso) => isoToLocalDate(iso)),
    [eventsByDay],
  );

  const selectedIso = dateToIsoLocal(selected);
  const selectedEvents = eventsByDay.get(selectedIso) ?? [];
  const selectedTotal = selectedEvents.reduce(
    (sum, event) => sum + (Number.parseFloat(event.amount) || 0),
    0,
  );

  const monthTotal = useMemo(() => {
    const y = month.getFullYear();
    const m = month.getMonth();
    const start = dateToIsoLocal(new Date(y, m, 1));
    const end = dateToIsoLocal(new Date(y, m + 1, 0));
    let sum = 0;
    for (const [iso, events] of eventsByDay) {
      if (iso < start || iso > end) continue;
      for (const event of events) sum += Number.parseFloat(event.amount) || 0;
    }
    return sum;
  }, [eventsByDay, month]);

  if (subscriptions.length === 0) return null;

  const viewingToday =
    month.getFullYear() === isoToLocalDate(today).getFullYear() &&
    month.getMonth() === isoToLocalDate(today).getMonth();

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_270px]">
      <div className="panel-flush overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-secondary/40 px-4 py-2.5">
          <span className="eyebrow">Expected dues</span>
          <div className="flex items-center gap-3">
            <span className="money text-[12px] text-muted-foreground">
              ${formatMoney(monthTotal)} this month
            </span>
            {viewingToday ? null : (
              <button
                type="button"
                onClick={() => {
                  const now = isoToLocalDate(today);
                  setMonth(now);
                  setSelected(now);
                }}
                className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
              >
                Today
              </button>
            )}
          </div>
        </div>

        <Calendar
          mode="single"
          required
          month={month}
          onMonthChange={setMonth}
          selected={selected}
          onSelect={setSelected}
          showOutsideDays
          className="w-full p-3 [--cell-size:2.6rem] sm:[--cell-size:3rem]"
          classNames={{
            root: "w-full",
            // `relative` must survive: the prev/next nav is absolutely
            // positioned against this box, and without it the arrows escape
            // into the panel header.
            months: "relative flex w-full flex-col",
            month: "flex w-full flex-col gap-3",
            month_grid: "w-full border-collapse",
            weekdays: "flex w-full",
            weekday:
              "flex-1 select-none pb-1 font-mono text-[9.5px] font-medium uppercase tracking-[0.16em] text-muted-foreground",
            week: "flex w-full",
            day: "group/day relative h-[--cell-size] w-full flex-1 p-[1px] text-center",
            today: "",
            outside: "opacity-40",
          }}
          modifiers={{ due: dueMatcher }}
          components={{
            DayButton: ({ day, modifiers, className, ...props }) => {
              const iso = dateToIsoLocal(day.date);
              const events = eventsByDay.get(iso) ?? [];
              const isToday = iso === today;
              const extra = events.length - MAX_DOTS;

              return (
                <CalendarDayButton
                  day={day}
                  modifiers={modifiers}
                  title={
                    events.length
                      ? events.map((e) => `${e.service} $${formatMoney(e.amount)}`).join(", ")
                      : undefined
                  }
                  className={cn(
                    "flex h-full w-full min-w-0 flex-col items-center justify-center gap-1 rounded-sm p-0 font-sans aspect-auto",
                    events.length &&
                      !modifiers.selected &&
                      "bg-ochre/[0.10] hover:bg-ochre/20",
                    isToday && !modifiers.selected && "ring-1 ring-inset ring-foreground/25",
                    className,
                  )}
                  {...props}
                >
                  <span
                    className={cn(
                      "text-[13px] leading-none tabular-nums",
                      events.length && "font-medium",
                    )}
                  >
                    {day.date.getDate()}
                  </span>

                  {/* Fixed-height marker row keeps every cell the same size. */}
                  <span className="flex h-[5px] items-center justify-center gap-[3px]">
                    {events.slice(0, MAX_DOTS).map((event) => (
                      <span
                        key={`${iso}-${event.service}`}
                        className={cn(
                          "h-[4px] w-[4px] rounded-full",
                          modifiers.selected ? "bg-primary-foreground/70" : "bg-oxblood",
                        )}
                      />
                    ))}
                    {extra > 0 ? (
                      <span
                        className={cn(
                          "font-mono text-[8px] leading-none",
                          modifiers.selected ? "text-primary-foreground/70" : "text-oxblood",
                        )}
                      >
                        +{extra}
                      </span>
                    ) : null}
                  </span>
                </CalendarDayButton>
              );
            },
          }}
        />
      </div>

      <aside className="panel-flush flex h-fit flex-col p-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="eyebrow">{formatDayMonth(selected)}</p>
          {selectedEvents.length ? (
            <span className="money text-[12px]">${formatMoney(selectedTotal)}</span>
          ) : null}
        </div>

        {selectedEvents.length === 0 ? (
          <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
            Nothing due on this day. Marked days carry a dot per subscription.
          </p>
        ) : (
          <ul className="mt-3 space-y-px">
            {selectedEvents.map((event) => (
              <li key={`${selectedIso}-${event.service}`}>
                <button
                  type="button"
                  className="flex w-full items-baseline justify-between gap-3 rounded-sm px-1.5 py-2 text-left transition-colors hover:bg-accent/60"
                  onClick={() => onSelectService?.(event.service)}
                >
                  <span className="flex min-w-0 items-baseline gap-2 text-[13px]">
                    <span className="h-1 w-1 shrink-0 translate-y-[-2px] rounded-full bg-oxblood" />
                    <span className="truncate">{event.service}</span>
                  </span>
                  <span className="money shrink-0 text-[13px]">${formatMoney(event.amount)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <hr className="hairline my-4" />

        <p className="eyebrow mb-2.5">All recurring</p>
        <ul className="space-y-2">
          {subscriptions.map((sub) => (
            <li key={`${sub.service}-${sub.amount}`}>
              <button
                type="button"
                className="group flex w-full items-baseline justify-between gap-3 text-left"
                onClick={() => onSelectService?.(sub.service)}
              >
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] text-muted-foreground transition-colors group-hover:text-foreground">
                    {sub.service}
                  </span>
                  {sub.nextExpectedDate ? (
                    <span className="money block text-[10.5px] text-muted-foreground/70">
                      {formatDate(sub.nextExpectedDate)}
                    </span>
                  ) : null}
                </span>
                <span className="money shrink-0 text-[12.5px] text-muted-foreground transition-colors group-hover:text-foreground">
                  ${formatMoney(sub.amount)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
