import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";

const SPECIMEN = [
  { merchant: "NETFLIX.COM  SYDNEY AU", amount: "18.99", cipher: "9f2a·c7d1·04be·a83f" },
  { merchant: "SPOTIFY P1A2B3C4", amount: "13.99", cipher: "41c8·9e07·bb52·1d6a" },
  { merchant: "GOOGLE *YOUTUBEPREM", amount: "22.99", cipher: "e0b4·372f·8a95·cc18" },
];

const PRINCIPLES = [
  {
    n: "01",
    title: "Parsed in your browser",
    body: "Bank PDFs, scans and CSVs are read on this device. Text extraction and OCR never leave the tab.",
  },
  {
    n: "02",
    title: "Encrypted before it leaves",
    body: "PBKDF2 at 600k iterations derives a key from your master password. Every row is sealed with AES-256-GCM.",
  },
  {
    n: "03",
    title: "A server that cannot read",
    body: "Postgres holds an opaque blob and a nonce. There is no decryption path on the backend — by construction.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="font-display text-lg leading-none">ZenoLedgr</span>
            <span className="eyebrow hidden sm:inline">Private Ledger</span>
          </Link>
          <nav className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link href="/signin">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/signup">Create account</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        {/* Hero — asymmetric, ruled margin like an accounting page */}
        <section className="rise grid gap-12 border-b border-border py-16 md:py-24 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
          <div className="space-y-7">
            <p className="eyebrow">Zero-knowledge bookkeeping</p>
            <h1 className="font-display text-[2.75rem] leading-[1.05] sm:text-6xl">
              The ledger
              <br />
              only <em className="italic text-oxblood">you</em> can read.
            </h1>
            <p className="max-w-prose text-[15px] leading-relaxed text-muted-foreground">
              Upload a bank statement and get your subscriptions, recurring dues and spending
              history — without handing anyone your transaction history. Merchant, amount and date
              are encrypted on this device before a single byte is sent.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/signup">
                  Start a private ledger
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/signin">I have an account</Link>
              </Button>
            </div>
            <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              <Lock className="h-3 w-3" />
              PBKDF2 600k · AES-256-GCM · blind backend
            </p>
          </div>

          {/* Specimen: what you see vs. what the server stores */}
          <div className="panel ledger-margin overflow-hidden self-start">
            <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-4 py-2.5">
              <span className="eyebrow">Statement excerpt</span>
              <span className="eyebrow text-oxblood">On this device</span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {SPECIMEN.map((row) => (
                  <tr key={row.merchant} className="border-b border-border/70">
                    <td className="py-2.5 pl-16 pr-3 font-mono text-[11px] text-muted-foreground">
                      {row.merchant}
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono text-[13px] tabular-nums">
                      ${row.amount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex items-center justify-between border-y border-border bg-secondary/40 px-4 py-2.5">
              <span className="eyebrow">Same rows in Postgres</span>
              <span className="eyebrow">Server view</span>
            </div>
            <table className="w-full text-sm">
              <tbody>
                {SPECIMEN.map((row) => (
                  <tr key={row.cipher} className="border-b border-border/70 last:border-0">
                    <td className="py-2.5 pl-16 pr-3 font-mono text-[11px] text-muted-foreground/60">
                      {row.cipher}
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono text-[13px] text-muted-foreground/60">
                      ▪▪▪▪
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Principles as numbered editorial entries */}
        <section className="rise rise-2 grid gap-px border-b border-border bg-border md:grid-cols-3">
          {PRINCIPLES.map((p) => (
            <article key={p.n} className="bg-background px-1 py-10 md:px-6">
              <p className="font-display text-2xl text-oxblood">{p.n}</p>
              <h3 className="mt-3 text-base font-semibold tracking-normal">{p.title}</h3>
              <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-muted-foreground">
                {p.body}
              </p>
            </article>
          ))}
        </section>

        <section className="rise rise-3 flex flex-wrap items-end justify-between gap-6 py-16">
          <div className="space-y-3">
            <h2 className="font-display text-3xl leading-tight">
              Bring a statement.
              <br />
              Keep the secret.
            </h2>
            <p className="max-w-prose text-[13px] leading-relaxed text-muted-foreground">
              Works with Commonwealth Bank, and any statement that has a merchant, an amount and a
              date.
            </p>
          </div>
          <Button asChild size="lg">
            <Link href="/signup">
              Create account
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-5">
          <p className="eyebrow">ZenoLedgr</p>
          <p className="font-mono text-[11px] text-muted-foreground">
            Encrypted client-side. Always.
          </p>
        </div>
      </footer>
    </div>
  );
}
