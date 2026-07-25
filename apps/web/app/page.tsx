import Link from "next/link";
import { Shield, Database, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto min-h-screen max-w-6xl p-6 md:p-10">
      <section className="app-surface rounded-2xl p-7 md:p-10">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-6">
            <p className="text-muted-foreground text-xs uppercase tracking-[0.24em]">
              ZenoLedgr / PriFi Ledger
            </p>
            <h1 className="max-w-2xl text-4xl font-semibold leading-tight md:text-5xl">
              The zero-knowledge
              <br />
              financial truth layer
            </h1>
            <p className="text-muted-foreground max-w-xl text-base leading-relaxed">
              Institutional-grade personal finance telemetry without surrendering sensitive
              transaction context. Merchant, amount, and date stay encrypted client-side.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/signin">Open secure workspace</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/signup">Create account</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3">
            <div className="metric-tile">
              <div className="mb-3 inline-flex rounded-md border border-border p-2">
                <Shield className="h-4 w-4" />
              </div>
              <p className="text-sm font-medium">Client-side encryption</p>
              <p className="text-muted-foreground mt-1 text-sm">
                PBKDF2 (600k) + AES-256-GCM with session-memory key handling.
              </p>
            </div>
            <div className="metric-tile">
              <div className="mb-3 inline-flex rounded-md border border-border p-2">
                <Database className="h-4 w-4" />
              </div>
              <p className="text-sm font-medium">Blind backend model</p>
              <p className="text-muted-foreground mt-1 text-sm">
                API and Postgres store opaque blobs + nonce only.
              </p>
            </div>
            <div className="metric-tile">
              <div className="mb-3 inline-flex rounded-md border border-border p-2">
                <Lock className="h-4 w-4" />
              </div>
              <p className="text-sm font-medium">Trust-minimized operations</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Supabase auth + RLS + scoped API data retrieval.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
