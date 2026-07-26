"use client";

import { useState } from "react";

import { Section } from "@/components/section";
import { PaymentsTable } from "@/features/ledger/payments-table";
import { SpendChart } from "@/features/ledger/spend-chart";
import { StatStrip } from "@/features/ledger/stat-strip";
import { StatementList } from "@/features/ledger/statement-list";
import { SubscriptionsPanel } from "@/features/ledger/subscriptions-panel";
import type { DetectedSubscription } from "@/lib/detect-subscriptions";
import type { DecryptedLedgerRow, StatementRow } from "@/lib/types";

const SUBS: DetectedSubscription[] = [
  {
    service: "Netflix",
    amount: "18.99",
    cadence: "monthly",
    confidence: "high",
    chargeCount: 6,
    firstPurchaseDate: "2026-02-12",
    lastChargeDate: "2026-07-12",
    nextExpectedDate: "2026-08-12",
    currentPeriodStart: "2026-07-12",
    currentPeriodEnd: "2026-08-11",
    stepDays: 30,
    rawMerchants: ["NETFLIX.COM SYDNEY AU"],
  },
  {
    service: "Spotify",
    amount: "13.99",
    cadence: "monthly",
    confidence: "high",
    chargeCount: 5,
    firstPurchaseDate: "2026-03-04",
    lastChargeDate: "2026-07-04",
    nextExpectedDate: "2026-08-03",
    currentPeriodStart: "2026-07-04",
    currentPeriodEnd: "2026-08-02",
    stepDays: 30,
    rawMerchants: ["SPOTIFY P1A2B3C4", "SPOTIFYAB"],
  },
  {
    service: "YouTube Premium",
    amount: "22.99",
    cadence: "monthly",
    confidence: "medium",
    chargeCount: 2,
    firstPurchaseDate: "2026-06-28",
    lastChargeDate: "2026-07-28",
    nextExpectedDate: "2026-07-28",
    currentPeriodStart: "2026-06-28",
    currentPeriodEnd: "2026-07-27",
    stepDays: 30,
    rawMerchants: ["GOOGLE *YOUTUBEPREM"],
  },
];

const ROWS: DecryptedLedgerRow[] = [
  ["Netflix", "NETFLIX.COM SYDNEY AU", "18.99", "2026-07-12", true],
  ["Spotify", "SPOTIFY P1A2B3C4", "13.99", "2026-07-04", true],
  ["YouTube Premium", "GOOGLE *YOUTUBEPREM", "22.99", "2026-06-28", true],
  ["Woolworths", "WOOLWORTHS 1234 BONDI", "142.60", "2026-07-19", false],
  ["Coles", "COLES 0456 SURRY HILLS", "88.15", "2026-07-16", false],
  ["Opal Travel", "OPAL TRAVEL SYDNEY", "40.00", "2026-07-15", false],
  ["Uber", "UBER *TRIP HELP.UBER", "27.40", "2026-07-14", true],
  ["Amazon AU", "AMAZON AU MARKETPLACE", "63.99", "2026-07-11", true],
].map(([display, raw, amount, date, matched], i) => ({
  id: `row-${i}`,
  createdAt: "2026-07-26T04:00:00Z",
  merchantDisplay: display as string,
  merchantRaw: raw as string,
  merchantMatched: matched as boolean,
  amount: amount as string,
  date: date as string,
  statementId: "stmt-1",
}));

const STATEMENTS: StatementRow[] = [
  {
    id: "stmt-1",
    filename: "cba-transactions-jul-2026.pdf",
    page_count: 4,
    payment_count: 38,
    created_at: "2026-07-26T04:00:00Z",
  },
  {
    id: "stmt-2",
    filename: "statement-scan.jpg",
    page_count: null,
    payment_count: 11,
    created_at: "2026-07-02T09:12:00Z",
  },
];

export default function UiPreviewPage() {
  const [selected, setSelected] = useState<DetectedSubscription | null>(null);

  if (process.env.NODE_ENV === "production") {
    return <p className="p-10 text-muted-foreground">Not available in production.</p>;
  }

  return (
    <main className="mx-auto max-w-[1180px] space-y-10 px-6 py-10">
      <header className="space-y-2">
        <p className="eyebrow">Your ledger · decrypted locally</p>
        <h1 className="font-display text-4xl leading-tight sm:text-[2.75rem]">
          Everything on record
        </h1>
      </header>

      <StatStrip
        paymentCount={49}
        totalVolume={4218.35}
        subscriptionCount={SUBS.length}
        monthlyRecurring={55.97}
        statementCount={STATEMENTS.length}
      />

      <Section
        index="01"
        eyebrow="Recurring"
        title="Subscriptions and what is due next"
        description="Cadence is inferred from your statements and rolled forward into the current cycle."
      >
        <SubscriptionsPanel
          subscriptions={SUBS}
          selected={selected}
          charges={ROWS.slice(0, 3)}
          onSelect={setSelected}
        />
      </Section>

      <Section index="02" eyebrow="History" title="Payments" description="One row per payment.">
        <PaymentsTable rows={ROWS} loading={false} />
      </Section>

      <Section index="03" eyebrow="Analysis" title="Where the money goes">
        <SpendChart rows={ROWS} loading={false} />
      </Section>

      <Section index="04" eyebrow="Sources" title="Statements">
        <StatementList
          statements={STATEMENTS}
          activeStatementId="stmt-1"
          onOpen={() => {}}
          onClearFilter={() => {}}
          onDelete={async () => {}}
        />
      </Section>
    </main>
  );
}
