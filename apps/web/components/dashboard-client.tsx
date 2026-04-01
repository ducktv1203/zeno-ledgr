"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { SecurityStatusBadge } from "@/components/security-status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import wiki from "@/data/merchant-wiki.json";
import {
  clearSessionCrypto,
  decryptLedgerPayload,
  encryptLedgerPayload,
  LedgerPlaintext,
  unlockWithPassword,
} from "@/lib/crypto";
import type { MerchantWikiEntry } from "@/lib/refiner";
import { refineMerchant } from "@/lib/refiner";
import { getBrowserSupabase } from "@/lib/supabase/client";

const wikiEntries = wiki as MerchantWikiEntry[];

function apiBase(): string {
  const u = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  return u.replace(/\/$/, "");
}

async function apiFetch(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<Response> {
  return fetch(`${apiBase()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

type Row = {
  id: string;
  created_at: string;
  plaintext: LedgerPlaintext;
  displayMerchant: string;
  wikiMatched: boolean;
};

export function DashboardClient() {
  const supabase = useMemo(() => getBrowserSupabase(), []);
  const [sessionReady, setSessionReady] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  const [saltB64, setSaltB64] = useState<string | null>(null);
  const [masterPassword, setMasterPassword] = useState("");
  const [cryptoError, setCryptoError] = useState<string | null>(null);
  const [encryptionActive, setEncryptionActive] = useState(false);

  const [rows, setRows] = useState<Row[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newMerchant, setNewMerchant] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newDate, setNewDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setSessionReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setAccessToken(data.session?.access_token ?? null);
      setSessionReady(true);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, sess) => {
      setAccessToken(sess?.access_token ?? null);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  const ensureSalt = useCallback(async () => {
    if (!accessToken) return;
    const res = await apiFetch("/crypto/init", accessToken, { method: "POST" });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(t || "Failed to init crypto salt");
    }
    const data = (await res.json()) as { password_salt: string };
    setSaltB64(data.password_salt);
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    (async () => {
      try {
        const res = await apiFetch("/crypto/salt", accessToken);
        if (res.status === 404) {
          await ensureSalt();
          return;
        }
        if (!res.ok) throw new Error(await res.text());
        const data = (await res.json()) as { password_salt: string };
        setSaltB64(data.password_salt);
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : "Salt load failed");
      }
    })();
  }, [accessToken, ensureSalt]);

  const loadLedger = useCallback(async () => {
    if (!accessToken || !encryptionActive) return;
    setLoadError(null);
    try {
      const res = await apiFetch("/retrieve", accessToken);
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as {
        id: string;
        encrypted_blob: string;
        nonce: string;
        created_at: string;
      }[];
      const decoded: Row[] = [];
      for (const r of data) {
        const plaintext = await decryptLedgerPayload(r.encrypted_blob, r.nonce);
        const { displayName, matched } = refineMerchant(
          plaintext.merchantRaw,
          wikiEntries,
        );
        decoded.push({
          id: r.id,
          created_at: r.created_at,
          plaintext,
          displayMerchant: displayName,
          wikiMatched: matched,
        });
      }
      setRows(decoded);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load ledger");
    }
  }, [accessToken, encryptionActive]);

  useEffect(() => {
    void loadLedger();
  }, [loadLedger]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) setAuthError(error.message);
  }

  async function signUpClick() {
    if (!supabase) return;
    setAuthError(null);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setAuthError(error.message);
  }

  async function signOut() {
    clearSessionCrypto();
    setEncryptionActive(false);
    setRows([]);
    setSaltB64(null);
    if (supabase) await supabase.auth.signOut();
  }

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setCryptoError(null);
    if (!saltB64) {
      setCryptoError("Salt not ready yet.");
      return;
    }
    try {
      await unlockWithPassword(masterPassword, saltB64);
      setEncryptionActive(true);
      setMasterPassword("");
    } catch (err) {
      setCryptoError(err instanceof Error ? err.message : "Unlock failed");
    }
  }

  function lock() {
    clearSessionCrypto();
    setEncryptionActive(false);
    setRows([]);
  }

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken || !encryptionActive) return;
    setSaving(true);
    setLoadError(null);
    try {
      const payload: LedgerPlaintext = {
        merchantRaw: newMerchant,
        amount: newAmount,
        date: newDate,
      };
      const { encrypted_blob, nonce } = await encryptLedgerPayload(payload);
      const res = await apiFetch("/ingest", accessToken, {
        method: "POST",
        body: JSON.stringify({ encrypted_blob, nonce }),
      });
      if (!res.ok) throw new Error(await res.text());
      setNewMerchant("");
      setNewAmount("");
      await loadLedger();
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const chartData = useMemo(() => {
    return rows.map((r) => ({
      name: r.displayMerchant.slice(0, 12) + (r.displayMerchant.length > 12 ? "…" : ""),
      amount: Number.parseFloat(r.plaintext.amount) || 0,
    }));
  }, [rows]);

  if (!sessionReady) {
    return (
      <p className="text-muted-foreground text-sm">Loading session…</p>
    );
  }

  if (!supabase) {
    return (
      <Card className="max-w-lg border-zinc-800 bg-zinc-950/50">
        <CardHeader>
          <CardTitle>Configure Supabase</CardTitle>
          <CardDescription>
            Add{" "}
            <code className="text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
            <code className="text-xs">apps/web/.env.local</code> (see root{" "}
            <code className="text-xs">.env.example</code>), then reload.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!accessToken) {
    return (
      <Card className="max-w-md border-zinc-800 bg-zinc-950/50">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Use Supabase Auth. Keys come from{" "}
            <code className="text-xs">.env.local</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={signIn}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw">Password</Label>
              <Input
                id="pw"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
            {authError ? (
              <p className="text-destructive text-sm">{authError}</p>
            ) : null}
            <div className="flex gap-2">
              <Button type="submit">Sign in</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => void signUpClick()}
              >
                Sign up
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Decrypted data exists only in this browser session.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SecurityStatusBadge encryptionActive={encryptionActive} />
          <Button variant="outline" size="sm" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </div>

      <Card className="border-zinc-800 bg-zinc-950/50">
        <CardHeader>
          <CardTitle>Master password</CardTitle>
          <CardDescription>
            PBKDF2 (600k) + AES-256-GCM in the browser. The AES key is held in
            memory for this tab session only (not persisted in sessionStorage);
            sessionStorage may store a non-secret “active” flag for the UI. The
            server only ever sees ciphertext.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!encryptionActive ? (
            <form className="flex flex-wrap items-end gap-3" onSubmit={unlock}>
              <div className="space-y-2">
                <Label htmlFor="mp">Master password</Label>
                <Input
                  id="mp"
                  type="password"
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  className="min-w-[220px]"
                  autoComplete="off"
                />
              </div>
              <Button type="submit" disabled={!saltB64}>
                Unlock
              </Button>
            </form>
          ) : (
            <Button type="button" variant="secondary" onClick={lock}>
              Lock encryption
            </Button>
          )}
          {cryptoError ? (
            <p className="text-destructive text-sm">{cryptoError}</p>
          ) : null}
          {!saltB64 ? (
            <p className="text-muted-foreground text-sm">
              Preparing salt… (ensure API is running and JWT secret matches
              Supabase.)
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-zinc-800 bg-zinc-950/50">
          <CardHeader>
            <CardTitle>Add entry</CardTitle>
            <CardDescription>
              Encrypted locally before sent to{" "}
              <code className="text-xs">/ingest</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={addEntry}>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="m">Merchant (raw)</Label>
                  <Input
                    id="m"
                    value={newMerchant}
                    onChange={(e) => setNewMerchant(e.target.value)}
                    placeholder="STARBUCKS STORE 1234"
                    disabled={!encryptionActive}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="a">Amount</Label>
                  <Input
                    id="a"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    placeholder="12.50"
                    disabled={!encryptionActive}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="d">Date</Label>
                  <Input
                    id="d"
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    disabled={!encryptionActive}
                  />
                </div>
              </div>
              <Button type="submit" disabled={!encryptionActive || saving}>
                {saving ? "Saving…" : "Encrypt & ingest"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-950/50">
          <CardHeader>
            <CardTitle>Amounts (decrypted)</CardTitle>
            <CardDescription>
              Recharts — values decrypted in your browser only.
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {chartData.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No entries yet. Add one or load existing after unlock.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-800" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(222.2 84% 4.9%)",
                      border: "1px solid hsl(217.2 32.6% 17.5%)",
                    }}
                  />
                  <Bar dataKey="amount" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-zinc-800 bg-zinc-950/50">
        <CardHeader>
          <CardTitle>Ledger</CardTitle>
          <CardDescription>
            Merchant names refined locally via{" "}
            <code className="text-xs">merchant-wiki.json</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadError ? (
            <p className="text-destructive mb-4 text-sm">{loadError}</p>
          ) : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Display (wiki)</TableHead>
                <TableHead>Raw</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    {r.displayMerchant}
                    {r.wikiMatched ? (
                      <span className="text-muted-foreground ml-2 text-xs">
                        (wiki)
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate font-mono text-xs">
                    {r.plaintext.merchantRaw}
                  </TableCell>
                  <TableCell>{r.plaintext.amount}</TableCell>
                  <TableCell>{r.plaintext.date}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {new Date(r.created_at).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
