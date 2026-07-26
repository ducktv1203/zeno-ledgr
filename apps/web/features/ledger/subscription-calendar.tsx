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
import { cn } from "@/lib/utils";

type DayEvent = {
  service: string;
  amount: string;
};

type Props = {
  subscriptions: DetectedSubscription[];
  onSelectService?: (service: string) => void;
};

function monthWindow(month: Date): { start: string; end: string } {
  const y = month.getFullYear();
  const m = month.getMonth();
  const start = new Date(y, m, 1 - 7);
  const end = new Date(y, m + 1, 7);
  return {
    start: dateToIsoLocal(start),
    end: dateToIsoLocal(end),
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
      // Always pin the rolled "next due" so the current cycle is visible
      if (sub.nextExpectedDate) {
        push(sub.nextExpectedDate, event);
      }
      for (const date of expectedDatesInRange(sub, start, end)) {
        push(date, event);
      }
    }
    return map;
  }, [subscriptions, month]);

  const dueMatcher: Matcher = useMemo(
    () => [...eventsByDay.keys()].map((iso) => isoToLocalDate(iso)),
    [eventsByDay],
  );

  const selectedIso = selected ? dateToIsoLocal(selected) : null;
  const selectedEvents = selectedIso ? (eventsByDay.get(selectedIso) ?? []) : [];

  const monthDueTotal = useMemo(() => {
    const y = month.getFullYear();
    const m = month.getMonth();
    const start = dateToIsoLocal(new Date(y, m, 1));
    const end = dateToIsoLocal(new Date(y, m + 1, 0));
    let sum = 0;
    for (const [iso, events] of eventsByDay) {
      if (iso < start || iso > end) continue;
      for (const e of events) sum += Number.parseFloat(e.amount) || 0;
    }
    return sum;
  }, [eventsByDay, month]);

  if (subscriptions.length === 0) return null;

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs">
        Days with a colored mark have an expected subscription due · ~$
        {monthDueTotal.toFixed(2)} this month
      </p>

      <Calendar
        mode="single"
        month={month}
        onMonthChange={setMonth}
        selected={selected}
        onSelect={setSelected}
        showOutsideDays
        className="w-full rounded-xl border border-border bg-card p-3 [--cell-size:2.75rem] sm:[--cell-size:3.25rem]"
        classNames={{
          root: "w-full",
          months: "w-full",
          month: "w-full",
          month_grid: "w-full border-collapse",
          weekdays: "flex w-full",
          weekday: "text-muted-foreground flex-1 select-none text-[0.8rem] font-normal",
          week: "mt-2 flex w-full",
          day: "group/day relative aspect-square h-full w-full flex-1 p-0 text-center",
        }}
        modifiers={{
          due: dueMatcher,
        }}
        modifiersClassNames={{
          due: "[&_button]:font-semibold",
        }}
        components={{
          DayButton: ({ day, modifiers, className, ...props }) => {
            const iso = dateToIsoLocal(day.date);
            const events = eventsByDay.get(iso) ?? [];
            const hasDue = events.length > 0 || Boolean(modifiers.due);
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
                  events.length
                    ? events.map((e) => `${e.service} $${e.amount}`).join(", ")
                    : undefined
                }
                className={cn(
                  className,
                  "relative",
                  hasDue &&
                    !modifiers.selected &&
                    "bg-sky-500/20 text-sky-50 hover:bg-sky-500/30",
                  hasDue && modifiers.selected && "ring-2 ring-sky-400/70 ring-offset-1 ring-offset-background",
                )}
                {...props}
              >
                <span className="text-sm tabular-nums">{day.date.getDate()}</span>
                {hasDue ? (
                  <>
                    <span className="bg-sky-400 absolute bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full sm:hidden" />
                    {label ? (
                      <span className="text-sky-200/90 hidden max-w-full truncate px-0.5 text-[9px] leading-none sm:block">
                        {label}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className="hidden h-1.5 sm:block" aria-hidden />
                )}
              </CalendarDayButton>
            );
          },
        }}
      />

      {selectedIso ? (
        <div className="border-border rounded-xl border bg-muted/20 px-3 py-2.5">
          <p className="mb-2 text-sm font-medium">
            {selected!.toLocaleDateString(undefined, {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
          {selectedEvents.length === 0 ? (
            <p className="text-muted-foreground text-sm">No expected dues on this day.</p>
          ) : (
            <ul className="space-y-1">
              {selectedEvents.map((e) => (
                <li key={`${selectedIso}-${e.service}`}>
                  <button
                    type="button"
                    className="hover:bg-muted/50 flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm"
                    onClick={() => onSelectService?.(e.service)}
                  >
                    <span className="flex items-center gap-2">
                      <span className="bg-sky-400 size-1.5 rounded-full" />
                      {e.service}
                    </span>
                    <span className="font-mono text-xs">${e.amount}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
