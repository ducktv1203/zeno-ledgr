"use client";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-destructive text-sm">Dashboard error: {error.message}</p>
      <Button type="button" variant="outline" onClick={reset}>
        Retry
      </Button>
    </div>
  );
}

