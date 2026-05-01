"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
    <main className="mx-auto max-w-6xl space-y-6 p-6 md:p-10">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs uppercase tracking-wider">
            ZenoLedgr
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Encrypted Finance Dashboard</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SecurityStatusBadge encryptionActive={cryptoActive} />
          <Button variant="outline" asChild>
            <Link href="/dashboard">Dashboard</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/settings">Settings</Link>
          </Button>
          <Button variant="outline" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </header>
      {children}
    </main>
  );
}

