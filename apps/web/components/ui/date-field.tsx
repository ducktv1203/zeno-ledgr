"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { CalendarDays } from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
import { dateToIsoLocal, isoToLocalDate, todayIso } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const PANEL_WIDTH = 320;
const PANEL_HEIGHT = 360;

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
  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  /*
   * Rendered in a portal with fixed coordinates: every section on the page is
   * `overflow-hidden`, which would otherwise clip the panel.
   */
  const place = React.useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < PANEL_HEIGHT && rect.top > spaceBelow;

    setPosition({
      top: openUp ? Math.max(8, rect.top - PANEL_HEIGHT - 6) : rect.bottom + 6,
      left: Math.min(Math.max(8, rect.left), window.innerWidth - PANEL_WIDTH - 8),
    });
  }, []);

  React.useLayoutEffect(() => {
    if (!open) return;
    place();
  }, [open, place]);

  React.useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place]);

  const selected = value ? isoToLocalDate(value) : undefined;

  const panel = (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Choose a date"
      style={{ top: position?.top ?? 0, left: position?.left ?? 0, width: PANEL_WIDTH }}
      className="panel fixed z-50 p-1 shadow-lg"
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
        classNames={{
          root: "w-full",
          months: "relative flex w-full flex-col",
          month: "flex w-full flex-col gap-3",
        }}
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
  );

  return (
    <div className={cn("relative", className)}>
      <button
        ref={triggerRef}
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

      {open && position ? createPortal(panel, document.body) : null}
    </div>
  );
}
