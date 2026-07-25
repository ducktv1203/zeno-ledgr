"use client";

import { useEffect, useState } from "react";
import { LedgerDashboard } from "@/features/ledger/ledger-dashboard";
import { useAuthClient } from "@/features/auth/use-auth";
import { apiEnsureSalt } from "@/lib/api";

export default function DashboardPage() {
  const auth = useAuthClient();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [saltB64, setSaltB64] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth) return;
    auth.auth.getSession().then(({ data }) => {
      setAccessToken(data.session?.access_token ?? null);
    });
  }, [auth]);

  useEffect(() => {
    if (!accessToken) return;
    (async () => {
      try {
        const data = await apiEnsureSalt(accessToken);
        setSaltB64(data.password_salt);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Salt bootstrap failed");
      }
    })();
  }, [accessToken]);

  if (!accessToken) {
    return <p className="text-muted-foreground text-sm">Loading session...</p>;
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="section-shell border-destructive/40">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      ) : null}
      <LedgerDashboard accessToken={accessToken} saltB64={saltB64} />
    </div>
  );
}
