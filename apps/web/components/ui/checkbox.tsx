"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & {
  /** Header state when only some of the rows below are ticked. */
  indeterminate?: boolean;
};

/**
 * Native checkbox tinted to match the theme. The browser control keeps the
 * keyboard and screen-reader behaviour that a div-based one would have to
 * reimplement.
 */
export function Checkbox({ className, indeterminate = false, ...props }: Props) {
  const ref = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      className={cn(
        "h-3.5 w-3.5 shrink-0 cursor-pointer accent-oxblood",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        className,
      )}
      {...props}
    />
  );
}
