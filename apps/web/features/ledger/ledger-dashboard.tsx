"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Eye,
  EyeOff,
  ShieldCheck,
  Wallet,
  Receipt,
  CalendarDays,
  Upload,
  Repeat,
} from "lucide-react";
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
import {
  parseStatementFile,
  type ParsedStatementRow,
} from "@/lib/parse-statement";
import { detectSubscriptions } from "@/lib/detect-subscriptions";
import { useLedger } from "@/features/ledger/use-ledger";

type Props = {
  accessToken: string;
  saltB64: string | null;
};

export function LedgerDashboard({ accessToken, saltB64 }: Props) {
  const [encryptionActive, setEncryptionActive] = useState(false);
  const [masterPassword, setMasterPassword] = useState("");
  const [showMasterPassword, setShowMasterPassword] = useState(false);
  const [cryptoError, setCryptoError] = useState<string | null>(null);
  const [newMerchant, setNewMerchant] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [pendingRows, setPendingRows] = useState<ParsedStatementRow[]>([]);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [parsingFile, setParsingFile] = useState(false);
  const [parseStatus, setParseStatus] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ledger = useLedger(accessToken, encryptionActive);

  useEffect(() => {
    if (!encryptionActive) return;
    void ledger.loadFirstPage();
  }, [encryptionActive, ledger.loadFirstPage]);

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

  async function onStatementFile(file: File | null) {
    setImportError(null);
    setParseWarnings([]);
    setPendingRows([]);
    setParseStatus(null);
    if (!file) return;
    setParsingFile(true);
    try {
      const parsed = await parseStatementFile(file, (p) => {
        setParseStatus(p.message);
      });
      setParseWarnings(parsed.warnings);
      setPendingRows(parsed.rows);
      if (parsed.rows.length === 0 && parsed.warnings.length === 0) {
        setImportError("No transactions found in that file.");
      }
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Failed to read statement");
    } finally {
      setParsingFile(false);
      setParseStatus(null);
    }
  }

  async function onImportStatement() {
    if (!encryptionActive || pendingRows.length === 0) return;
    setImporting(true);
    setImportError(null);
    setImportProgress({ done: 0, total: pendingRows.length });
    try {
      await ledger.addEntries(pendingRows, (done, total) => {
        setImportProgress({ done, total });
      });
      setPendingRows([]);
      setParseWarnings([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Import failed partway — refresh and retry");
    } finally {
      setImporting(false);
      setImportProgress(null);
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

  const totalVolume = useMemo(
    () =>
      ledger.rows.reduce(
        (sum, row) => sum + (Number.isFinite(Number(row.amount)) ? Number(row.amount) : 0),
        0,
      ),
    [ledger.rows],
  );

  const subscriptions = useMemo(() => detectSubscriptions(ledger.rows), [ledger.rows]);

  return (
    <div className="space-y-6">
      <section className="grid gap-3 md:grid-cols-3">
        <div className="metric-tile">
          <p className="text-muted-foreground text-xs uppercase tracking-[0.12em]">
            Entries
          </p>
          <p className="mt-2 text-2xl font-semibold">{ledger.rows.length}</p>
        </div>
        <div className="metric-tile">
          <p className="text-muted-foreground text-xs uppercase tracking-[0.12em]">
            Local volume
          </p>
          <p className="mt-2 text-2xl font-semibold">{totalVolume.toFixed(2)}</p>
        </div>
        <div className="metric-tile">
          <p className="text-muted-foreground text-xs uppercase tracking-[0.12em]">
            Session state
          </p>
          <p className="mt-2 text-sm font-medium">
            {encryptionActive ? "Unlocked" : "Locked"}
          </p>
        </div>
      </section>

      <Card className="app-surface rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Security and unlock
          </CardTitle>
          <CardDescription>
            Key is held in memory for this tab session. Backend only stores ciphertext.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!encryptionActive ? (
            <form className="flex flex-wrap items-end gap-3" onSubmit={unlock}>
              <div className="space-y-2">
                <Label htmlFor="master-password">Master password</Label>
                <div className="flex gap-2">
                  <Input
                    id="master-password"
                    type={showMasterPassword ? "text" : "password"}
                    value={masterPassword}
                    onChange={(e) => setMasterPassword(e.target.value)}
                    className="min-w-[220px]"
                    autoComplete="off"
                    required
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowMasterPassword((v) => !v)}
                    aria-label={showMasterPassword ? "Hide master password" : "Show master password"}
                  >
                    {showMasterPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
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

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Card className="app-surface rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Add encrypted entry
            </CardTitle>
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

        <Card className="app-surface rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Spending insights
            </CardTitle>
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

      <Card className="app-surface rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Statement upload
          </CardTitle>
          <CardDescription>
            Upload a bank PDF, a photo of a statement, or CSV. Text PDFs parse instantly; scanned
            pages and photos run on-device OCR in this browser, then encrypt before ingest.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="statement-file">Bank statement</Label>
            <Input
              id="statement-file"
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf,image/*,.png,.jpg,.jpeg,.webp,.csv,text/csv"
              disabled={!encryptionActive || importing || parsingFile}
              onChange={(e) => void onStatementFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-muted-foreground text-xs">
              Sample sketch statement:{" "}
              <a className="underline underline-offset-2" href="/samples/sample-statement.pdf" download>
                sample-statement.pdf
              </a>{" "}
              (12 payments — Netflix/Spotify repeat monthly)
            </p>
          </div>

          {parsingFile && parseStatus ? (
            <p className="text-sm text-muted-foreground">{parseStatus}</p>
          ) : null}

          {parseWarnings.map((w) => (
            <p key={w} className="text-muted-foreground text-sm">
              {w}
            </p>
          ))}
          {importError ? <p className="text-destructive text-sm">{importError}</p> : null}

          {pendingRows.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm">
                Ready to import <strong>{pendingRows.length}</strong> payment
                {pendingRows.length === 1 ? "" : "s"}
                {parseWarnings.some((w) => w.startsWith("Read "))
                  ? ""
                  : ""}
                . Preview shows the first {Math.min(12, pendingRows.length)}.
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Merchant</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingRows.slice(0, 12).map((row) => (
                    <TableRow key={`${row.line}-${row.merchantRaw}-${row.date}`}>
                      <TableCell className="max-w-[280px] truncate font-mono text-xs">
                        {row.merchantRaw}
                      </TableCell>
                      <TableCell>${row.amount}</TableCell>
                      <TableCell>{row.date}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  disabled={!encryptionActive || importing}
                  onClick={() => void onImportStatement()}
                >
                  {importing
                    ? `Encrypting ${importProgress?.done ?? 0}/${importProgress?.total ?? pendingRows.length}…`
                    : `Encrypt and import ${pendingRows.length}`}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={importing || parsingFile}
                  onClick={() => {
                    setPendingRows([]);
                    setParseWarnings([]);
                    setImportError(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="app-surface rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Repeat className="h-4 w-4" />
            Subscriptions
          </CardTitle>
          <CardDescription>
            Recurring bills only (Netflix, YouTube, Spotify…). Groceries, transit, and Afterpay stay
            in Payments — not listed here. Grouping is local from your decrypted ledger.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!encryptionActive ? (
            <p className="text-muted-foreground text-sm">Unlock to detect subscriptions.</p>
          ) : subscriptions.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No subscriptions detected yet. You need at least two similar charges for the same
              service (e.g. YouTube in June and July).
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subscription</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Cadence</TableHead>
                  <TableHead>First purchase</TableHead>
                  <TableHead>Last charged</TableHead>
                  <TableHead>Next expected</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map((s) => (
                  <TableRow key={`${s.service}-${s.amount}-${s.firstPurchaseDate}`}>
                    <TableCell>
                      <div className="font-medium">{s.service}</div>
                      <div className="text-muted-foreground text-xs">
                        {s.chargeCount} charge{s.chargeCount === 1 ? "" : "s"} · {s.confidence}{" "}
                        confidence
                        {s.rawMerchants.length > 1
                          ? ` · ${s.rawMerchants.length} bank labels merged`
                          : ""}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">${s.amount}</TableCell>
                    <TableCell className="capitalize">{s.cadence}</TableCell>
                    <TableCell>{s.firstPurchaseDate}</TableCell>
                    <TableCell>{s.lastChargeDate}</TableCell>
                    <TableCell>{s.nextExpectedDate ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="app-surface rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Payments
          </CardTitle>
          <CardDescription>
            Each row is a payment: merchant + amount + transaction date (from your statement).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {ledger.loadError ? (
            <p className="text-destructive text-sm">{ledger.loadError}</p>
          ) : null}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Merchant</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Imported</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.rows.length === 0 && !ledger.loadingRows ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground text-center">
                    No payments yet.
                  </TableCell>
                </TableRow>
              ) : null}
              {ledger.rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium">{row.merchantDisplay}</div>
                    {row.merchantMatched ? (
                      <div className="text-muted-foreground text-xs">matched locally</div>
                    ) : (
                      <div className="text-muted-foreground max-w-[240px] truncate font-mono text-xs">
                        {row.merchantRaw}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm">${row.amount}</TableCell>
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

