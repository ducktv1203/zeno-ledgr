import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="max-w-xl space-y-4 text-center">
        <p className="text-muted-foreground text-sm uppercase tracking-widest">
          ZenoLedgr
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          The Zero-Knowledge Financial Truth
        </h1>
        <p className="text-muted-foreground text-lg">
          Privacy-first ledger: encrypt in the browser; the API stores only opaque
          blobs. Open source and trust-minimized.
        </p>
        <div className="flex justify-center gap-3 pt-4">
          <Button asChild>
            <Link href="/signin">Sign in</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/signup">Create account</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
