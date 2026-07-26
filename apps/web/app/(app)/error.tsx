"use client";

import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="panel max-w-xl space-y-5 p-6">
      <div className="space-y-2">
        <p className="eyebrow text-oxblood">Something broke</p>
        <h1 className="font-display text-3xl leading-tight">This page stopped short.</h1>
      </div>
      <p className="rounded-sm border border-oxblood/25 bg-oxblood/[0.07] px-3 py-2 font-mono text-[12px] leading-relaxed text-oxblood">
        {error.message || "Unknown error"}
      </p>
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        Your ledger data is untouched — nothing is written unless an import completes.
      </p>
      <Button onClick={reset}>
        <RotateCcw className="h-4 w-4" />
        Try again
      </Button>
    </div>
  );
}
