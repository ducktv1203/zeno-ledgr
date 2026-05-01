"use client";

import { useEffect, useState } from "react";
import { LedgerDashboard } from "@/features/ledger/ledger-dashboard";
import { useAuthClient } from "@/features/auth/use-auth";
import { apiGetSalt, apiInitSalt } from "@/lib/api";

export default function DashboardPage() {
  const supabase = useAuthClient();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [saltB64, setSaltB64] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setAccessToken(data.session?.access_token ?? null);
    });
  }, [supabase]);

  useEffect(() => {
    if (!accessToken) return;
    (async () => {
      try {
        const data = await apiGetSalt(accessToken);
        setSaltB64(data.password_salt);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Salt bootstrap failed";
        if (message.includes("404")) {
          const init = await apiInitSalt(accessToken);
          setSaltB64(init.password_salt);
          return;
        }
        setError(message);
      }
    })();
  }, [accessToken]);

  if (!accessToken) {
    return <p className="text-muted-foreground text-sm">Loading session...</p>;
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <LedgerDashboard accessToken={accessToken} saltB64={saltB64} />
    </div>
  );
}

