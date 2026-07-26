import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded border border-input bg-background/60 px-2.5 py-1 text-sm transition-colors",
          "file:mr-3 file:h-7 file:cursor-pointer file:rounded-sm file:border file:border-border file:bg-secondary file:px-2 file:font-sans file:text-xs file:font-medium file:text-foreground",
          "placeholder:text-muted-foreground/70",
          "focus-visible:border-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25",
          "disabled:cursor-not-allowed disabled:bg-muted/50 disabled:opacity-60",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
