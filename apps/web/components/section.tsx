import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Editorial section shell: eyebrow, serif title, hairline rule. Used for every
 * major block of the console so the page reads like a ruled ledger rather than
 * a stack of floating cards.
 */

type SectionProps = React.HTMLAttributes<HTMLElement> & {
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  aside?: React.ReactNode;
};

export function Section({
  eyebrow,
  title,
  description,
  aside,
  className,
  children,
  ...props
}: SectionProps) {
  return (
    <section className={cn("panel overflow-hidden", className)} {...props}>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border bg-secondary/40 px-5 py-4">
        <div className="min-w-0 space-y-1.5">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h2 className="font-display text-[22px] leading-tight">{title}</h2>
          {description ? (
            <p className="max-w-prose text-[13px] leading-relaxed text-muted-foreground">
              {description}
            </p>
          ) : null}
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </header>
      <div className="px-5 py-5">{children}</div>
    </section>
  );
}

export function EmptyNote({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "ledger-rules rounded border border-dashed border-border bg-background/40 px-4 py-6",
        className,
      )}
    >
      <p className="max-w-prose text-[13px] leading-relaxed text-muted-foreground">{children}</p>
    </div>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-sm border border-oxblood/25 bg-oxblood/[0.07] px-3 py-2 text-[13px] text-oxblood">
      {children}
    </p>
  );
}
