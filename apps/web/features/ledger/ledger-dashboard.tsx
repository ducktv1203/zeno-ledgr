"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Lock } from "lucide-react";

import { ErrorNote, Section } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ManualEntryForm } from "@/features/ledger/manual-entry-form";
import { PaymentsTable } from "@/features/ledger/payments-table";
import { SpendChart } from "@/features/ledger/spend-chart";
import { StatStrip } from "@/features/ledger/stat-strip";
import { StatementImport } from "@/features/ledger/statement-import";
import { StatementList } from "@/features/ledger/statement-list";
import { SubscriptionsPanel } from "@/features/ledger/subscriptions-panel";
import { VaultPanel } from "@/features/ledger/vault-panel";
import { useLedger } from "@/features/ledger/use-ledger";
import { clearSessionCrypto, unlockWithPassword } from "@/lib/crypto";
import { useSubscriptionOverrides } from "@/lib/subscription-overrides";
import { useCryptoUnlocked } from "@/lib/use-crypto-status";
import {
  detectSubscriptions,
  groupSubscriptions,
  rowsForSubscription,
  type DetectedSubscription,
} from "@/lib/detect-subscriptions";

type Props = {
  accessToken: string;
  saltB64: string | null;
};

/** Normalise every cadence to a monthly figure so the total is comparable. */
function monthlyEquivalent(subscriptions: DetectedSubscription[]): number {
  return subscriptions.reduce((sum, sub) => {
    const amount = Number.parseFloat(sub.amount) || 0;
    const step = sub.stepDays && sub.stepDays > 0 ? sub.stepDays : 30;
    return sum + amount * (30 / step);
  }, 0);
}

export function LedgerDashboard({ accessToken, saltB64 }: Props) {
  // Sourced from the crypto module so an idle auto-lock closes the book too.
  const encryptionActive = useCryptoUnlocked();
  const { dismissed, confirmed } = useSubscriptionOverrides();
  const [activeStatementId, setActiveStatementId] = useState<string | null>(null);
  const [selectedSub, setSelectedSub] = useState<DetectedSubscription | null>(null);

  const ledger = useLedger(accessToken, encryptionActive);

  useEffect(() => {
    if (!encryptionActive) {
      setActiveStatementId(null);
      setSelectedSub(null);
      return;
    }
    void ledger.loadFirstPage();
  }, [encryptionActive, ledger.loadFirstPage]);

  const unlock = useCallback(
    async (masterPassword: string) => {
      if (!saltB64) return;
      await unlockWithPassword(masterPassword, saltB64);
    },
    [saltB64],
  );

  const visibleRows = useMemo(() => {
    if (!activeStatementId) return ledger.rows;
    return ledger.rows.filter((row) => row.statementId === activeStatementId);
  }, [ledger.rows, activeStatementId]);

  const totalVolume = useMemo(
    () =>
      visibleRows.reduce((sum, row) => {
        const amount = Number.parseFloat(row.amount);
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0),
    [visibleRows],
  );

  const subscriptions = useMemo(() => detectSubscriptions(ledger.rows), [ledger.rows]);

  // Headline figures describe what is still billing: recurrences that went
  // quiet are left out until the user confirms they still pay for them.
  const billingNow = useMemo(
    () => groupSubscriptions(subscriptions, { dismissed, confirmed }).active,
    [subscriptions, dismissed, confirmed],
  );

  const manualCount = useMemo(
    () => ledger.rows.filter((row) => !row.statementId).length,
    [ledger.rows],
  );

  const subCharges = useMemo(
    () => (selectedSub ? rowsForSubscription(selectedSub, ledger.rows) : []),
    [selectedSub, ledger.rows],
  );

  const activeStatement =
    ledger.statements.find((statement) => statement.id === activeStatementId) ?? null;

  if (!encryptionActive) {
    return <VaultPanel saltReady={Boolean(saltB64)} onUnlock={unlock} />;
  }

  return (
    <div className="space-y-10">
      <header className="rise flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <p className="eyebrow">Your ledger · decrypted locally</p>
          <h1 className="font-display text-4xl leading-tight sm:text-[2.75rem]">
            {activeStatement ? activeStatement.filename : "Everything on record"}
          </h1>
          {activeStatement ? (
            <button
              type="button"
              className="link-underline text-[12.5px] text-muted-foreground"
              onClick={() => setActiveStatementId(null)}
            >
              Showing one statement — view all payments
            </button>
          ) : null}
        </div>
        <Button variant="outline" onClick={() => clearSessionCrypto()}>
          <Lock className="h-4 w-4" />
          Lock session
        </Button>
      </header>

      {ledger.loadError ? <ErrorNote>{ledger.loadError}</ErrorNote> : null}

      <div className="rise rise-1">
        <StatStrip
          paymentCount={visibleRows.length}
          totalVolume={totalVolume}
          subscriptionCount={billingNow.length}
          monthlyRecurring={monthlyEquivalent(billingNow)}
          statementCount={ledger.statements.length}
        />
      </div>

      <Section
        className="rise rise-2"
        eyebrow="Recurring"
        title="Subscriptions and what is due next"
        description="Merchants that bill a steady amount on a steady cycle go straight on the calendar. Anything that repeats less convincingly — two charges so far, a wandering billing date, a cycle that stopped — waits in the review list below for you to say whether you still pay it."
        aside={
          billingNow.length > 0 ? (
            <Badge variant="outline">{billingNow.length} billing</Badge>
          ) : null
        }
      >
        <SubscriptionsPanel
          subscriptions={subscriptions}
          selected={selectedSub}
          charges={subCharges}
          onSelect={setSelectedSub}
        />
      </Section>

      <Section
        className="rise rise-3"
        eyebrow="History"
        title="Payments"
        description={
          activeStatement
            ? `Every payment imported from ${activeStatement.filename}. Search, sort and filter without leaving the page.`
            : "One row per payment — merchant, amount, transaction date. Tick any row to delete it; the filter panel narrows to manually added entries when you need to clear them out."
        }
      >
        <PaymentsTable
          rows={visibleRows}
          loading={ledger.loadingRows}
          onDelete={ledger.removeEntries}
        />
      </Section>

      <Section
        className="rise rise-4"
        eyebrow="Analysis"
        title="Where the money goes"
        description="Outflow grouped into groceries, food, transport, entertainment and the rest. Reassign a merchant and this device remembers it — seed rules are only the first guess."
      >
        <SpendChart rows={visibleRows} loading={ledger.loadingRows} />
      </Section>

      <Section
        eyebrow="Sources"
        title="Statements"
        description="Open a statement to filter payments down to it. Deleting one removes the file and every encrypted row that came from it — the way to re-import a corrected copy."
      >
        <StatementList
          statements={ledger.statements}
          activeStatementId={activeStatementId}
          manualCount={manualCount}
          onOpen={(id) => {
            setActiveStatementId(id);
            setSelectedSub(null);
          }}
          onClearFilter={() => setActiveStatementId(null)}
          onDelete={async (id) => {
            await ledger.removeStatement(id);
            if (activeStatementId === id) setActiveStatementId(null);
          }}
        />
      </Section>

      <Section
        eyebrow="Import"
        title="Add a statement"
        description="Read on this device, encrypted on this device. Nothing legible leaves the browser."
      >
        <StatementImport
          onImport={async (rows, meta, onProgress) => {
            const result = await ledger.addEntries(rows, meta, onProgress);
            if (result.statementId) setActiveStatementId(result.statementId);
            return { statementId: result.statementId };
          }}
        />
      </Section>

      <Section
        eyebrow="Manual"
        title="Add a single payment"
        description="For anything a statement missed. Encrypted client-side before it is stored, like every other row."
      >
        <ManualEntryForm onSubmit={ledger.addEntry} />
      </Section>
    </div>
  );
}
