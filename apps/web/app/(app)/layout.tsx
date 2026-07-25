"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, Settings, LogOut, Lock } from "lucide-react";
import { SecurityStatusBadge } from "@/components/security-status-badge";
import { Button } from "@/components/ui/button";
import { clearSessionCrypto, isCryptoUnlocked } from "@/lib/crypto";
import { useAuthClient } from "@/features/auth/use-auth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
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
      <main className="mx-auto max-w-6xl p-6">
        <p className="text-muted-foreground text-sm">Loading dashboard...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-[1400px] p-4 md:p-6">
      <div className="grid gap-4 lg:grid-cols-[250px_1fr]">
        <aside className="app-surface rounded-2xl p-4">
          <div className="border-b border-border pb-4">
            <p className="text-muted-foreground text-[11px] uppercase tracking-[0.18em]">
              ZenoLedgr
            </p>
            <p className="mt-2 text-lg font-semibold">Operations Console</p>
          </div>
          <nav className="mt-4 space-y-2">
            <Button variant="secondary" className="w-full justify-start gap-2" asChild>
              <Link href="/dashboard">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-2" asChild>
              <Link href="/settings">
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </Button>
          </nav>
          <div className="mt-6 border-t border-border pt-4">
            <div className="mb-3">
              <SecurityStatusBadge encryptionActive={cryptoActive} />
            </div>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => void signOut()}>
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </aside>

        <section className="space-y-4">
          <header className="app-surface rounded-2xl px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">Encrypted Finance Dashboard</h1>
                <p className="text-muted-foreground text-sm">
                  Blind orchestration mode active. Sensitive ledger data remains local.
                </p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs">
                <Lock className="h-3.5 w-3.5" />
                Zero-knowledge path
              </div>
            </div>
          </header>
          {children}
        </section>
      </div>
    </main>
  );
}

