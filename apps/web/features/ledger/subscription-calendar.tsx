"use client";

import { useMemo, useState } from "react";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import {
  expectedDatesInRange,
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

function toDate(iso: string): Date {
  // Noon UTC avoids DST / timezone day-shift when DayPicker reads local date parts.
  return new Date(`${iso}T12:00:00Z`);
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function monthRange(month: Date): { start: string; end: string } {
  const y = month.getUTCFullYear();
  const m = month.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1));
  const end = new Date(Date.UTC(y, m + 1, 0));
  // Pad a week either side so outside days still get markers
  start.setUTCDate(start.getUTCDate() - 7);
  end.setUTCDate(end.getUTCDate() + 7);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export function SubscriptionCalendar({ subscriptions, onSelectService }: Props) {
  const today = todayIso();
  const [month, setMonth] = useState(() => toDate(today));
  const [selected, setSelected] = useState<Date | undefined>(toDate(today));

  const eventsByDay = useMemo(() => {
    const { start, end } = monthRange(month);
    const map = new Map<string, DayEvent[]>();
    for (const sub of subscriptions) {
      for (const date of expectedDatesInRange(sub, start, end)) {
        const list = map.get(date) ?? [];
        list.push({ service: sub.service, amount: sub.amount });
        map.set(date, list);
      }
    }
    return map;
  }, [subscriptions, month]);

  const dueDates = useMemo(
    () => [...eventsByDay.keys()].map((iso) => toDate(iso)),
    [eventsByDay],
  );

  const selectedIso = selected ? toIso(selected) : null;
  const selectedEvents = selectedIso ? (eventsByDay.get(selectedIso) ?? []) : [];

  const monthDueTotal = useMemo(() => {
    const y = month.getUTCFullYear();
    const m = month.getUTCMonth();
    const start = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
    const end = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
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
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          Expected dues this month · ~${monthDueTotal.toFixed(2)}
        </p>
      </div>

      <Calendar
        mode="single"
        month={month}
        onMonthChange={setMonth}
        selected={selected}
        onSelect={setSelected}
        showOutsideDays
        className="w-full rounded-xl border border-border bg-card p-3 [--cell-size:2.75rem] sm:[--cell-size:3rem]"
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
          due: dueDates,
        }}
        modifiersClassNames={{
          due: "font-medium",
        }}
        components={{
          DayButton: ({ day, modifiers, className, ...props }) => {
            const iso = toIso(day.date);
            const events = eventsByDay.get(iso) ?? [];
            return (
              <CalendarDayButton
                day={day}
                modifiers={modifiers}
                className={cn(
                  className,
                  events.length > 0 &&
                    !modifiers.selected &&
                    "bg-sky-500/15 text-sky-50 hover:bg-sky-500/25",
                )}
                {...props}
              >
                <span>{day.date.getUTCDate()}</span>
                {events.length > 0 ? (
                  <span className="flex items-center justify-center gap-0.5">
                    {events.slice(0, 3).map((e) => (
                      <span
                        key={`${iso}-${e.service}`}
                        className="bg-sky-400 size-1 rounded-full"
                        title={`${e.service} · $${e.amount}`}
                      />
                    ))}
                  </span>
                ) : (
                  <span className="size-1 opacity-0" aria-hidden />
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
              timeZone: "UTC",
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
                    <span>{e.service}</span>
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
