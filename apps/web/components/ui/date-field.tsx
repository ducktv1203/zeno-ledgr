"use client";

import * as React from "react";
import { CalendarDays } from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
import { dateToIsoLocal, isoToLocalDate, todayIso } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  id?: string;
  /** YYYY-MM-DD */
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
};

/**
 * Date input that opens the app's own calendar. The native picker ignores the
 * theme entirely, which is jarring next to everything else on the page.
 */
export function DateField({
  id,
  value,
  onChange,
  disabled,
  className,
  placeholder = "Pick a date",
}: Props) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const selected = value ? isoToLocalDate(value) : undefined;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded border border-input bg-background/60 px-3 text-left text-[13px] transition-colors",
          "hover:border-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-50",
          open && "border-foreground/30",
        )}
      >
        <span className={cn("money", !value && "text-muted-foreground")}>
          {value ? formatDate(value) : placeholder}
        </span>
        <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Choose a date"
          className="panel absolute left-0 top-[calc(100%+6px)] z-50 w-[min(20rem,calc(100vw-2rem))] p-1 shadow-lg"
        >
          <Calendar
            mode="single"
            required
            selected={selected}
            defaultMonth={selected ?? new Date()}
            onSelect={(date) => {
              if (!date) return;
              onChange(dateToIsoLocal(date));
              setOpen(false);
            }}
            className="w-full [--cell-size:2.15rem]"
            classNames={{ root: "w-full", months: "w-full", month: "w-full" }}
          />

          <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-1.5">
            <button
              type="button"
              className="link-underline font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground"
              onClick={() => {
                onChange(todayIso());
                setOpen(false);
              }}
            >
              Today
            </button>
            <button
              type="button"
              className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
