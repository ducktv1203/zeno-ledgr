"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { clearSessionCrypto, unlockWithPassword } from "@/lib/crypto";
import { useLedger } from "@/features/ledger/use-ledger";

type Props = {
  accessToken: string;
  saltB64: string | null;
};

export function LedgerDashboard({ accessToken, saltB64 }: Props) {
  const [encryptionActive, setEncryptionActive] = useState(false);
  const [masterPassword, setMasterPassword] = useState("");
  const [cryptoError, setCryptoError] = useState<string | null>(null);
  const [newMerchant, setNewMerchant] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const ledger = useLedger(accessToken, encryptionActive);

  useEffect(() => {
    if (!encryptionActive) return;
    void ledger.loadFirstPage();
  }, [encryptionActive, ledger]);

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    if (!saltB64) return;
    setCryptoError(null);
    try {
      await unlockWithPassword(masterPassword, saltB64);
      setEncryptionActive(true);
      setMasterPassword("");
    } catch (e) {
      setCryptoError(e instanceof Error ? e.message : "Unlock failed");
    }
  }

  function lock() {
    clearSessionCrypto();
    setEncryptionActive(false);
  }

  async function onAddEntry(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await ledger.addEntry({ merchantRaw: newMerchant, amount: newAmount, date: newDate });
      setNewMerchant("");
      setNewAmount("");
    } catch {
      // hook exposes detailed loadError after refresh
    } finally {
      setSaving(false);
    }
  }

  const chartData = useMemo(
    () =>
      ledger.rows.map((row) => ({
        name:
          row.merchantDisplay.slice(0, 14) +
          (row.merchantDisplay.length > 14 ? "…" : ""),
        amount: Number.parseFloat(row.amount) || 0,
      })),
    [ledger.rows],
  );

  return (
    <div className="space-y-6">
      <Card className="border-zinc-800 bg-zinc-950/50">
        <CardHeader>
          <CardTitle>Security and unlock</CardTitle>
          <CardDescription>
            Key is held in memory for this tab session. Backend only stores ciphertext.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!encryptionActive ? (
            <form className="flex flex-wrap items-end gap-3" onSubmit={unlock}>
              <div className="space-y-2">
                <Label htmlFor="master-password">Master password</Label>
                <Input
                  id="master-password"
                  type="password"
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  className="min-w-[220px]"
                  autoComplete="off"
                  required
                />
              </div>
              <Button type="submit" disabled={!saltB64}>
                Unlock
              </Button>
            </form>
          ) : (
            <Button type="button" variant="outline" onClick={lock}>
              Lock session
            </Button>
          )}
          {!saltB64 ? (
            <p className="text-muted-foreground text-sm">
              Waiting for per-user salt from API...
            </p>
          ) : null}
          {cryptoError ? <p className="text-destructive text-sm">{cryptoError}</p> : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-zinc-800 bg-zinc-950/50">
          <CardHeader>
            <CardTitle>Add encrypted entry</CardTitle>
            <CardDescription>Payload encrypts client-side before POST /ingest.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onAddEntry}>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="merchant">Merchant raw</Label>
                  <Input
                    id="merchant"
                    value={newMerchant}
                    onChange={(e) => setNewMerchant(e.target.value)}
                    disabled={!encryptionActive}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    disabled={!encryptionActive}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    disabled={!encryptionActive}
                  />
                </div>
              </div>
              <Button type="submit" disabled={!encryptionActive || saving}>
                {saving ? "Encrypting..." : "Encrypt and ingest"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-950/50">
          <CardHeader>
            <CardTitle>Spending insights</CardTitle>
            <CardDescription>Chart from decrypted local session data.</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            {ledger.loadingRows ? (
              <Skeleton className="h-full w-full" />
            ) : chartData.length === 0 ? (
              <p className="text-muted-foreground text-sm">No entries to chart yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-800" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="amount" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-zinc-800 bg-zinc-950/50">
        <CardHeader>
          <CardTitle>Ledger entries</CardTitle>
          <CardDescription>Refined merchant labels are computed locally.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {ledger.loadError ? (
            <p className="text-destructive text-sm">{ledger.loadError}</p>
          ) : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Display</TableHead>
                <TableHead>Raw</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.rows.length === 0 && !ledger.loadingRows ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground text-center">
                    No entries yet.
                  </TableCell>
                </TableRow>
              ) : null}
              {ledger.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    {row.merchantDisplay}
                    {row.merchantMatched ? (
                      <span className="text-muted-foreground ml-2 text-xs">(wiki)</span>
                    ) : null}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate font-mono text-xs">
                    {row.merchantRaw}
                  </TableCell>
                  <TableCell>{row.amount}</TableCell>
                  <TableCell>{row.date}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {new Date(row.createdAt).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {ledger.hasMore ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => void ledger.loadNextPage()}
              disabled={ledger.loadingRows}
            >
              {ledger.loadingRows ? "Loading..." : "Load more"}
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

