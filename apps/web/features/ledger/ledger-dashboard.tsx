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
  FileText,
  Trash2,
  X,
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
import {
  detectSubscriptions,
  formatPeriod,
  rowsForSubscription,
  type DetectedSubscription,
} from "@/lib/detect-subscriptions";
import { useLedger } from "@/features/ledger/use-ledger";
import { SubscriptionCalendar } from "@/features/ledger/subscription-calendar";

const PAYMENTS_PER_PAGE = 25;

type Props = {
  accessToken: string;
  saltB64: string | null;
};

type PendingMeta = {
  filename: string;
  pageCount?: number;
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
  const [pendingMeta, setPendingMeta] = useState<PendingMeta | null>(null);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [parsingFile, setParsingFile] = useState(false);
  const [parseStatus, setParseStatus] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(
    null,
  );
  const [statementError, setStatementError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeStatementId, setActiveStatementId] = useState<string | null>(null);
  const [selectedSub, setSelectedSub] = useState<DetectedSubscription | null>(null);
  const [paymentPage, setPaymentPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const paymentsRef = useRef<HTMLDivElement>(null);

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
    setActiveStatementId(null);
    setSelectedSub(null);
    setPaymentPage(1);
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
    setPendingMeta(null);
    setParseStatus(null);
    if (!file) return;
    setParsingFile(true);
    try {
      const parsed = await parseStatementFile(file, (p) => {
        setParseStatus(p.message);
      });
      setParseWarnings(parsed.warnings);
      setPendingRows(parsed.rows);
      setPendingMeta({
        filename: file.name,
        pageCount: parsed.pageCount,
      });
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
    if (!encryptionActive || pendingRows.length === 0 || !pendingMeta) return;
    setImporting(true);
    setImportError(null);
    setImportProgress({ done: 0, total: pendingRows.length });
    try {
      const result = await ledger.addEntries(
        pendingRows,
        {
          filename: pendingMeta.filename,
          pageCount: pendingMeta.pageCount ?? null,
        },
        (done, total) => {
          setImportProgress({ done, total });
        },
      );
      setPendingRows([]);
      setPendingMeta(null);
      setParseWarnings([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (result.statementId) {
        setActiveStatementId(result.statementId);
        setPaymentPage(1);
      }
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Import failed partway — refresh and retry");
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  }

  async function onDeleteStatement(id: string) {
    setStatementError(null);
    setDeletingId(id);
    try {
      await ledger.removeStatement(id);
      if (activeStatementId === id) setActiveStatementId(null);
      setPaymentPage(1);
    } catch (e) {
      setStatementError(e instanceof Error ? e.message : "Failed to delete statement");
    } finally {
      setDeletingId(null);
    }
  }

  function openStatement(id: string) {
    setActiveStatementId(id);
    setSelectedSub(null);
    setPaymentPage(1);
    paymentsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const filteredRows = useMemo(() => {
    if (!activeStatementId) return ledger.rows;
    return ledger.rows.filter((r) => r.statementId === activeStatementId);
  }, [ledger.rows, activeStatementId]);

  const paymentPageCount = Math.max(1, Math.ceil(filteredRows.length / PAYMENTS_PER_PAGE));

  useEffect(() => {
    if (paymentPage > paymentPageCount) setPaymentPage(paymentPageCount);
  }, [paymentPage, paymentPageCount]);

  const pageRows = useMemo(() => {
    const start = (paymentPage - 1) * PAYMENTS_PER_PAGE;
    return filteredRows.slice(start, start + PAYMENTS_PER_PAGE);
  }, [filteredRows, paymentPage]);

  const chartData = useMemo(
    () =>
      filteredRows.slice(0, 40).map((row) => ({
        name:
          row.merchantDisplay.slice(0, 14) +
          (row.merchantDisplay.length > 14 ? "…" : ""),
        amount: Number.parseFloat(row.amount) || 0,
      })),
    [filteredRows],
  );

  const totalVolume = useMemo(
    () =>
      filteredRows.reduce(
        (sum, row) => sum + (Number.isFinite(Number(row.amount)) ? Number(row.amount) : 0),
        0,
      ),
    [filteredRows],
  );

  const subscriptions = useMemo(() => detectSubscriptions(ledger.rows), [ledger.rows]);

  const subCharges = useMemo(
    () => (selectedSub ? rowsForSubscription(selectedSub, ledger.rows) : []),
    [selectedSub, ledger.rows],
  );

  const activeStatement = ledger.statements.find((s) => s.id === activeStatementId) ?? null;

  return (
    <div className="space-y-6">
      <section className="grid gap-3 md:grid-cols-3">
        <div className="metric-tile">
          <p className="text-muted-foreground text-xs uppercase tracking-[0.12em]">
            Payments
          </p>
          <p className="mt-2 text-2xl font-semibold">{filteredRows.length}</p>
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
            <FileText className="h-4 w-4" />
            Statements
          </CardTitle>
          <CardDescription>
            Manage uploads. Open a statement to see its payments; delete removes the statement and
            its encrypted rows. Re-upload by deleting then importing a new file.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {statementError ? <p className="text-destructive text-sm">{statementError}</p> : null}
          {!encryptionActive ? (
            <p className="text-muted-foreground text-sm">Unlock to manage statements.</p>
          ) : ledger.statements.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No statements yet. Upload a PDF or CSV below.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Payments</TableHead>
                  <TableHead>Pages</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.statements.map((s) => {
                  const open = activeStatementId === s.id;
                  return (
                    <TableRow key={s.id} className={open ? "bg-muted/40" : undefined}>
                      <TableCell className="max-w-[220px] truncate font-medium">
                        {s.filename}
                      </TableCell>
                      <TableCell>{s.payment_count}</TableCell>
                      <TableCell>{s.page_count ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {new Date(s.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={open ? "secondary" : "outline"}
                            onClick={() => openStatement(s.id)}
                          >
                            {open ? "Viewing" : "Open"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={deletingId === s.id}
                            onClick={() => {
                              if (
                                confirm(
                                  `Delete “${s.filename}” and all ${s.payment_count} payments from it?`,
                                )
                              ) {
                                void onDeleteStatement(s.id);
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {activeStatement ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                Filtering payments to <span className="text-foreground font-medium">{activeStatement.filename}</span>
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setActiveStatementId(null);
                  setPaymentPage(1);
                }}
              >
                Show all
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="app-surface rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Statement upload
          </CardTitle>
          <CardDescription>
            Upload a bank PDF, a photo of a statement, or CSV. Text PDFs parse instantly; scanned
            pages and photos run on-device OCR in this browser, then encrypt before ingest.
            Bank footers and notices are skipped — only real payments are kept.
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
                {pendingMeta ? ` from ${pendingMeta.filename}` : ""}. Preview shows the first{" "}
                {Math.min(12, pendingRows.length)}.
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
                    setPendingMeta(null);
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
            Recurrence is rolled forward from your statements into the current cycle — next due
            stays in the present, not stuck in the past. Click a row or calendar chip for charges.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!encryptionActive ? (
            <p className="text-muted-foreground text-sm">Unlock to detect subscriptions.</p>
          ) : subscriptions.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No subscriptions detected yet. You need at least two similar charges for the same
              service (e.g. YouTube in June and July).
            </p>
          ) : (
            <>
              <SubscriptionCalendar
                subscriptions={subscriptions}
                onSelectService={(service) => {
                  const match = subscriptions.find((s) => s.service === service) ?? null;
                  setSelectedSub(match);
                }}
              />
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subscription</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Cadence</TableHead>
                    <TableHead>Last charged</TableHead>
                    <TableHead>Current period</TableHead>
                    <TableHead>Next due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscriptions.map((s) => {
                    const active =
                      selectedSub?.service === s.service && selectedSub.amount === s.amount;
                    const period = formatPeriod(s.currentPeriodStart, s.currentPeriodEnd);
                    return (
                      <TableRow
                        key={`${s.service}-${s.amount}-${s.firstPurchaseDate}`}
                        className={`cursor-pointer ${active ? "bg-muted/40" : "hover:bg-muted/30"}`}
                        onClick={() => setSelectedSub(active ? null : s)}
                      >
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
                        <TableCell>{s.lastChargeDate}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {period ?? "—"}
                        </TableCell>
                        <TableCell className="font-medium">{s.nextExpectedDate ?? "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </>
          )}

          {selectedSub ? (
            <div className="border-border space-y-3 rounded-xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{selectedSub.service} charges</p>
                  <p className="text-muted-foreground text-sm">
                    ${selectedSub.amount} · {subCharges.length} record
                    {subCharges.length === 1 ? "" : "s"}
                    {selectedSub.nextExpectedDate
                      ? ` · next due ${selectedSub.nextExpectedDate}`
                      : ""}
                    {formatPeriod(selectedSub.currentPeriodStart, selectedSub.currentPeriodEnd)
                      ? ` · period ${formatPeriod(selectedSub.currentPeriodStart, selectedSub.currentPeriodEnd)}`
                      : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedSub(null)}
                  aria-label="Close subscription charges"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Merchant</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subCharges.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="font-medium">{row.merchantDisplay}</div>
                        <div className="text-muted-foreground max-w-[280px] truncate font-mono text-xs">
                          {row.merchantRaw}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">${row.amount}</TableCell>
                      <TableCell>{row.date}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div ref={paymentsRef}>
        <Card className="app-surface rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Payments
            </CardTitle>
            <CardDescription>
              Real payment rows only (merchant + amount + transaction date). Bank notices and $0
              lines are filtered out.
              {activeStatement ? ` Showing ${activeStatement.filename}.` : ""}
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
                {pageRows.length === 0 && !ledger.loadingRows ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground text-center">
                      No payments yet.
                    </TableCell>
                  </TableRow>
                ) : null}
                {pageRows.map((row) => (
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

            {filteredRows.length > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-muted-foreground text-sm">
                  Page {paymentPage} of {paymentPageCount} · {filteredRows.length} payment
                  {filteredRows.length === 1 ? "" : "s"} · {PAYMENTS_PER_PAGE} per page
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={paymentPage <= 1}
                    onClick={() => setPaymentPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={paymentPage >= paymentPageCount}
                    onClick={() => setPaymentPage((p) => Math.min(paymentPageCount, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
