"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";

import { SecurityStatusBadge } from "@/components/security-status-badge";
import { Button } from "@/components/ui/button";
import { clearSessionCrypto, isCryptoUnlocked } from "@/lib/crypto";
import { useAuthClient } from "@/features/auth/use-auth";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Ledger" },
  { href: "/settings", label: "Settings" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useAuthClient();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [cryptoActive, setCryptoActive] = useState(false);

  useEffect(() => {
    if (!supabase) {
      router.push("/signin");
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      const ok = Boolean(data.session?.access_token);
      setAuthed(ok);
      setReady(true);
      if (!ok) router.push("/signin");
      setCryptoActive(isCryptoUnlocked());
    });
  }, [router, supabase]);

  async function signOut() {
    clearSessionCrypto();
    if (supabase) {
      await supabase.auth.signOut();
    }
    router.push("/signin");
    router.refresh();
  }

  if (!ready || !authed) {
    return (
      <main className="mx-auto max-w-6xl px-6 py-16">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
          Opening ledger…
        </p>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1180px] flex-wrap items-center gap-x-6 gap-y-3 px-6 py-3">
          <Link href="/dashboard" className="flex items-baseline gap-2">
            <span className="font-display text-lg leading-none">ZenoLedgr</span>
          </Link>

          <nav className="flex items-center gap-1">
            {NAV.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative px-2 py-1 font-mono text-[11px] uppercase tracking-[0.16em] transition-colors",
                    active
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                  {active ? (
                    <span className="absolute -bottom-[13px] left-0 h-[2px] w-full bg-oxblood" />
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <SecurityStatusBadge encryptionActive={cryptoActive} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void signOut()}
              aria-label="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-6 pb-20 pt-10">{children}</main>
    </div>
  );
}
