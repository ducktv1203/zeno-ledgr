"use client";

import { X } from "lucide-react";

import { EmptyNote } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SubscriptionCalendar } from "@/features/ledger/subscription-calendar";
import {
  formatPeriod,
  todayIso,
  type DetectedSubscription,
} from "@/lib/detect-subscriptions";
import { formatDate, formatMoney } from "@/lib/format";
import type { DecryptedLedgerRow } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  subscriptions: DetectedSubscription[];
  selected: DetectedSubscription | null;
  charges: DecryptedLedgerRow[];
  onSelect: (subscription: DetectedSubscription | null) => void;
};

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const today = todayIso();
  const ms = Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

function dueLabel(iso: string | null): string {
  const days = daysUntil(iso);
  if (days === null) return "—";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 0) return `${Math.abs(days)}d overdue`;
  return `in ${days}d`;
}

function sameSubscription(a: DetectedSubscription | null, b: DetectedSubscription): boolean {
  return a?.service === b.service && a?.amount === b.amount;
}

export function SubscriptionsPanel({ subscriptions, selected, charges, onSelect }: Props) {
  if (subscriptions.length === 0) {
    return (
      <EmptyNote>
        No subscriptions detected yet. Two similar charges for the same service — YouTube in June
        and July, say — is enough for a cadence to appear here.
      </EmptyNote>
    );
  }

  return (
    <div className="space-y-6">
      <SubscriptionCalendar
        subscriptions={subscriptions}
        onSelectService={(service) =>
          onSelect(subscriptions.find((s) => s.service === service) ?? null)
        }
      />

      <hr className="hairline" />

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Subscription</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Cadence</TableHead>
            <TableHead>Current period</TableHead>
            <TableHead className="text-right">Next due</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {subscriptions.map((sub) => {
            const active = sameSubscription(selected, sub);
            const days = daysUntil(sub.nextExpectedDate);
            return (
              <TableRow
                key={`${sub.service}-${sub.amount}-${sub.firstPurchaseDate}`}
                data-state={active ? "selected" : undefined}
                className="cursor-pointer"
                onClick={() => onSelect(active ? null : sub)}
              >
                <TableCell>
                  <div className="flex items-baseline gap-2">
                    <span className="font-display text-lg leading-none">{sub.service}</span>
                    {sub.confidence === "high" ? (
                      <Badge variant="success">Confirmed</Badge>
                    ) : (
                      <Badge variant="secondary">{sub.confidence}</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-[11.5px] text-muted-foreground">
                    {sub.chargeCount} charge{sub.chargeCount === 1 ? "" : "s"} · since{" "}
                    {formatDate(sub.firstPurchaseDate)}
                    {sub.rawMerchants.length > 1
                      ? ` · ${sub.rawMerchants.length} bank labels merged`
                      : ""}
                  </p>
                </TableCell>
                <TableCell className="money whitespace-nowrap text-right text-[15px]">
                  ${formatMoney(sub.amount)}
                </TableCell>
                <TableCell className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  {sub.cadence}
                </TableCell>
                <TableCell className="whitespace-nowrap text-[12.5px] text-muted-foreground">
                  {formatPeriod(sub.currentPeriodStart, sub.currentPeriodEnd) ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="whitespace-nowrap">
                    <span className="money text-[13px]">
                      {formatDate(sub.nextExpectedDate)}
                    </span>
                    <span
                      className={cn(
                        "ml-2 font-mono text-[10.5px] uppercase tracking-[0.12em]",
                        days !== null && days <= 3 ? "text-oxblood" : "text-muted-foreground",
                      )}
                    >
                      {dueLabel(sub.nextExpectedDate)}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {selected ? (
        <div className="panel-flush space-y-4 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-display text-xl leading-none">{selected.service}</p>
              <p className="mt-1.5 text-[12.5px] text-muted-foreground">
                {charges.length} charge{charges.length === 1 ? "" : "s"} on record · $
                {formatMoney(selected.amount)} {selected.cadence}
                {selected.nextExpectedDate
                  ? ` · next ${formatDate(selected.nextExpectedDate)}`
                  : ""}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onSelect(null)}
              aria-label="Close charge history"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Merchant on statement</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {charges.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="max-w-[340px]">
                    <div className="font-medium">{row.merchantDisplay}</div>
                    <div className="truncate font-mono text-[11px] text-muted-foreground">
                      {row.merchantRaw}
                    </div>
                  </TableCell>
                  <TableCell className="money text-right">${formatMoney(row.amount)}</TableCell>
                  <TableCell className="money text-right text-muted-foreground">
                    {formatDate(row.date)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </div>
  );
}
