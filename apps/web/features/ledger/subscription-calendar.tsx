"use client";

import { useMemo, useState } from "react";
import type { Matcher } from "react-day-picker";

import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import {
  dateToIsoLocal,
  expectedDatesInRange,
  isoToLocalDate,
  todayIso,
  type DetectedSubscription,
} from "@/lib/detect-subscriptions";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

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
  const [selected, setSelected] = useState<Date | undefined>(() => isoToLocalDate(today));

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

  const selectedIso = selected ? dateToIsoLocal(selected) : null;
  const selectedEvents = selectedIso ? (eventsByDay.get(selectedIso) ?? []) : [];

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

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
      <div className="panel-flush overflow-hidden">
        <div className="flex items-baseline justify-between gap-3 border-b border-border bg-secondary/40 px-4 py-2.5">
          <span className="eyebrow">Expected dues</span>
          <span className="money text-[12px] text-muted-foreground">
            ${formatMoney(monthTotal)} this month
          </span>
        </div>

        <Calendar
          mode="single"
          month={month}
          onMonthChange={setMonth}
          selected={selected}
          onSelect={setSelected}
          showOutsideDays
          className="w-full p-3 [--cell-size:2.75rem] sm:[--cell-size:3.25rem]"
          classNames={{
            root: "w-full",
            months: "w-full",
            month: "w-full",
            month_grid: "w-full border-collapse",
            weekdays: "flex w-full",
            weekday: "text-muted-foreground flex-1 select-none font-mono text-[10px] font-medium uppercase tracking-[0.14em]",
            week: "mt-1 flex w-full",
            day: "group/day relative aspect-square h-full w-full flex-1 p-0 text-center",
          }}
          modifiers={{ due: dueMatcher }}
          components={{
            DayButton: ({ day, modifiers, className, ...props }) => {
              const iso = dateToIsoLocal(day.date);
              const events = eventsByDay.get(iso) ?? [];
              const hasDue = events.length > 0;
              const label =
                events.length === 1
                  ? events[0]!.service
                  : events.length > 1
                    ? `${events.length} dues`
                    : null;

              return (
                <CalendarDayButton
                  day={day}
                  modifiers={modifiers}
                  title={
                    hasDue
                      ? events.map((e) => `${e.service} $${formatMoney(e.amount)}`).join(", ")
                      : undefined
                  }
                  className={cn(
                    "rounded-sm font-sans",
                    hasDue && !modifiers.selected && "bg-ochre/[0.14] hover:bg-ochre/25",
                    hasDue && "font-medium",
                  )}
                  {...props}
                >
                  <span className="text-[13px] tabular-nums">{day.date.getDate()}</span>
                  {hasDue ? (
                    <>
                      <span className="mx-auto block h-1 w-1 rounded-full bg-oxblood sm:hidden" />
                      {label ? (
                        <span
                          className={cn(
                            "hidden max-w-full truncate px-0.5 text-[9px] leading-none sm:block",
                            modifiers.selected ? "text-primary-foreground/80" : "text-oxblood",
                          )}
                        >
                          {label}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <span className="hidden h-[9px] sm:block" aria-hidden />
                  )}
                </CalendarDayButton>
              );
            },
          }}
        />
      </div>

      {/* Day detail rail */}
      <aside className="panel-flush h-fit p-4">
        <p className="eyebrow">
          {selected
            ? selected.toLocaleDateString(undefined, { day: "numeric", month: "long" })
            : "Pick a day"}
        </p>

        {selectedEvents.length === 0 ? (
          <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
            {selected
              ? "Nothing due on this day."
              : "Select a marked day to see what is due."}
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
                  <span className="flex items-baseline gap-2 text-[13px]">
                    <span className="h-1 w-1 shrink-0 rounded-full bg-oxblood" />
                    {event.service}
                  </span>
                  <span className="money text-[13px]">${formatMoney(event.amount)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <hr className="hairline my-4" />

        <p className="eyebrow mb-2.5">All recurring</p>
        <ul className="space-y-1.5">
          {subscriptions.map((sub) => (
            <li key={sub.service}>
              <button
                type="button"
                className="flex w-full items-baseline justify-between gap-3 text-left text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => onSelectService?.(sub.service)}
              >
                <span className="truncate">{sub.service}</span>
                <span className="money shrink-0">${formatMoney(sub.amount)}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
