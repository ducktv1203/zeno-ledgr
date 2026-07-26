"use client";

import { useMemo, useState } from "react";
import { Ban, RotateCcw, X } from "lucide-react";

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
import { useSubscriptionOverrides } from "@/lib/subscription-overrides";
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

function monthsAgo(days: number): string {
  if (days < 45) return `${days}d ago`;
  const months = Math.round(days / 30);
  return months >= 12 ? `${Math.round(months / 12)}y ago` : `${months} months ago`;
}

export function SubscriptionsPanel({ subscriptions, selected, charges, onSelect }: Props) {
  const { dismissed, dismiss, restore, restoreAll } = useSubscriptionOverrides();
  const [showLapsed, setShowLapsed] = useState(false);
  const [showDismissed, setShowDismissed] = useState(false);

  const groups = useMemo(() => {
    const active: DetectedSubscription[] = [];
    const lapsed: DetectedSubscription[] = [];
    const removed: DetectedSubscription[] = [];

    for (const sub of subscriptions) {
      if (dismissed.has(sub.key)) removed.push(sub);
      else if (sub.status === "lapsed") lapsed.push(sub);
      else active.push(sub);
    }
    return { active, lapsed, removed };
  }, [subscriptions, dismissed]);

  function remove(sub: DetectedSubscription) {
    dismiss(sub.key);
    if (selected?.key === sub.key) onSelect(null);
  }

  if (subscriptions.length === 0) {
    return (
      <EmptyNote>
        No subscriptions detected yet. A charge becomes a subscription once the same merchant bills
        a steady amount on a steady cycle — three times on the same day of the month, or twice for
        a service we recognise.
      </EmptyNote>
    );
  }

  return (
    <div className="space-y-6">
      {groups.active.length > 0 ? (
        <SubscriptionCalendar
          subscriptions={groups.active}
          onSelectService={(service) =>
            onSelect(groups.active.find((s) => s.service === service) ?? null)
          }
        />
      ) : (
        <EmptyNote>
          Nothing is billing right now. Every recurrence we found has either stopped or been
          dismissed, so the calendar is clear.
        </EmptyNote>
      )}

      {groups.active.length > 0 ? (
        <>
          <hr className="hairline" />
          <SubscriptionTable
            subscriptions={groups.active}
            selected={selected}
            onSelect={onSelect}
            onDismiss={remove}
          />
        </>
      ) : null}

      {groups.lapsed.length > 0 ? (
        <GroupDisclosure
          open={showLapsed}
          onToggle={() => setShowLapsed((v) => !v)}
          label={`${groups.lapsed.length} stopped billing`}
          hint="Charged on a cycle once, then went quiet for several cycles. Not counted in your monthly total and never shown on the calendar."
        >
          <ul className="divide-y divide-border border-y border-border">
            {groups.lapsed.map((sub) => (
              <li key={sub.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-[13.5px] font-medium">{sub.service}</span>
                    <Badge variant="outline">Ended</Badge>
                  </div>
                  <p className="money mt-1 text-[11.5px] text-muted-foreground">
                    ${formatMoney(sub.amount)} {sub.cadence} · last charged{" "}
                    {formatDate(sub.lastChargeDate)} ({monthsAgo(sub.daysSinceLastCharge)})
                    {sub.cyclesMissed > 0 ? ` · ${sub.cyclesMissed} cycles missed` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button type="button" size="sm" variant="outline" onClick={() => onSelect(sub)}>
                    Charges
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => remove(sub)}
                    aria-label={`Dismiss ${sub.service}`}
                  >
                    <Ban className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </GroupDisclosure>
      ) : null}

      {groups.removed.length > 0 ? (
        <GroupDisclosure
          open={showDismissed}
          onToggle={() => setShowDismissed((v) => !v)}
          label={`${groups.removed.length} not a subscription`}
          hint="You told us these are ordinary spending. Kept out of every total until you put one back."
          action={
            <button
              type="button"
              onClick={restoreAll}
              className="link-underline font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground"
            >
              Restore all
            </button>
          }
        >
          <ul className="divide-y divide-border border-y border-border">
            {groups.removed.map((sub) => (
              <li key={sub.key} className="flex items-center justify-between gap-4 py-2.5">
                <span className="min-w-0 truncate text-[13px] text-muted-foreground">
                  {sub.service}
                  <span className="money ml-2 text-[11.5px]">${formatMoney(sub.amount)}</span>
                </span>
                <Button type="button" size="sm" variant="ghost" onClick={() => restore(sub.key)}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        </GroupDisclosure>
      ) : null}

      {selected ? (
        <ChargeHistory subscription={selected} charges={charges} onClose={() => onSelect(null)} />
      ) : null}
    </div>
  );
}

function SubscriptionTable({
  subscriptions,
  selected,
  onSelect,
  onDismiss,
}: {
  subscriptions: DetectedSubscription[];
  selected: DetectedSubscription | null;
  onSelect: (subscription: DetectedSubscription | null) => void;
  onDismiss: (subscription: DetectedSubscription) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Subscription</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Cadence</TableHead>
          <TableHead>Current period</TableHead>
          <TableHead className="text-right">Next due</TableHead>
          <TableHead className="w-8" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {subscriptions.map((sub) => {
          const open = selected?.key === sub.key;
          const days = daysUntil(sub.nextExpectedDate);
          return (
            <TableRow
              key={sub.key}
              data-state={open ? "selected" : undefined}
              className="cursor-pointer"
              onClick={() => onSelect(open ? null : sub)}
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
                  <span className="money text-[13px]">{formatDate(sub.nextExpectedDate)}</span>
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
              <TableCell>
                <button
                  type="button"
                  title="Not a subscription"
                  aria-label={`${sub.service} is not a subscription`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDismiss(sub);
                  }}
                  className="text-muted-foreground/60 transition-colors hover:text-oxblood"
                >
                  <Ban className="h-3.5 w-3.5" />
                </button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function GroupDisclosure({
  open,
  onToggle,
  label,
  hint,
  action,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  hint: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
        >
          {open ? "− " : "+ "}
          {label}
        </button>
        {open ? action : null}
      </div>
      {open ? (
        <>
          <p className="max-w-prose text-[12.5px] leading-relaxed text-muted-foreground">{hint}</p>
          {children}
        </>
      ) : null}
    </div>
  );
}

function ChargeHistory({
  subscription,
  charges,
  onClose,
}: {
  subscription: DetectedSubscription;
  charges: DecryptedLedgerRow[];
  onClose: () => void;
}) {
  return (
    <div className="panel-flush space-y-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-xl leading-none">{subscription.service}</p>
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">
            {charges.length} charge{charges.length === 1 ? "" : "s"} on record · $
            {formatMoney(subscription.amount)} {subscription.cadence}
            {subscription.nextExpectedDate
              ? ` · next ${formatDate(subscription.nextExpectedDate)}`
              : ` · stopped ${monthsAgo(subscription.daysSinceLastCharge)}`}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onClose}
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
  );
}
