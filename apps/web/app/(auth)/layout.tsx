import Link from "next/link";
import { Lock } from "lucide-react";

const ASSURANCES = [
  "Statements are parsed on this device",
  "Rows are sealed with AES-256-GCM before upload",
  "The server stores ciphertext and a nonce — nothing else",
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_minmax(420px,38%)]">
      {/* Editorial brand panel */}
      <aside className="relative hidden flex-col justify-between border-r border-border bg-secondary/50 p-10 lg:flex xl:p-14">
        <div className="ledger-rules pointer-events-none absolute inset-0 opacity-[0.55]" />

        <Link href="/" className="relative flex items-baseline gap-2">
          <span className="font-display text-lg leading-none">ZenoLedgr</span>
          <span className="eyebrow">Private Ledger</span>
        </Link>

        <div className="relative max-w-xl space-y-6">
          <h2 className="font-display text-5xl leading-[1.05]">
            The ledger
            <br />
            only <em className="italic text-oxblood">you</em> can read.
          </h2>
          <p className="max-w-prose text-[14px] leading-relaxed text-muted-foreground">
            Your account password gets you in the door. Your master password — which never leaves
            this browser — is what actually opens the book.
          </p>
        </div>

        <ul className="relative space-y-2.5">
          {ASSURANCES.map((line) => (
            <li key={line} className="flex items-start gap-2.5 text-[13px] text-muted-foreground">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-oxblood" />
              {line}
            </li>
          ))}
        </ul>
      </aside>

      <main className="flex flex-col justify-center px-6 py-12 sm:px-10">
        <Link href="/" className="mb-10 flex items-baseline gap-2 lg:hidden">
          <span className="font-display text-lg leading-none">ZenoLedgr</span>
          <span className="eyebrow">Private Ledger</span>
        </Link>

        <div className="rise mx-auto w-full max-w-sm">{children}</div>

        <p className="mx-auto mt-10 flex w-full max-w-sm items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
          <Lock className="h-3 w-3" />
          Encrypted client-side
        </p>
      </main>
    </div>
  );
}
