"use client";

import { useMemo, useState } from "react";
import { Ban, Check, RotateCcw, X } from "lucide-react";

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
  groupSubscriptions,
  todayIso,
  type DetectedSubscription,
} from "@/lib/detect-subscriptions";
import { formatDate, formatMoney } from "@/lib/format";
import { cleanMerchantLabel } from "@/lib/merchant-label";
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

/** Say plainly what stopped this from going on the calendar by itself. */
function reviewNote(sub: DetectedSubscription): string {
  const last = `last charged ${formatDate(sub.lastChargeDate)}`;

  if (sub.reviewReason === "stopped") {
    return `${last} (${monthsAgo(sub.daysSinceLastCharge)})${
      sub.cyclesMissed > 0 ? ` · ${sub.cyclesMissed} cycles missed` : ""
    }`;
  }
  if (sub.reviewReason === "sparse") {
    return sub.chargeCount === 1
      ? `one charge so far, on ${formatDate(sub.lastChargeDate)}`
      : `only ${sub.chargeCount} charges so far · ${formatDate(sub.firstPurchaseDate)} and ${formatDate(
          sub.lastChargeDate,
        )}`;
  }
  if (sub.reviewReason === "amount") {
    return `${sub.chargeCount} charges on a steady cycle, but the amount changes each time · ${last}`;
  }
  return `${sub.chargeCount} charges, roughly every ${sub.medianGapDays ?? sub.stepDays} days, but the billing date wanders · ${last}`;
}

export function SubscriptionsPanel({ subscriptions, selected, charges, onSelect }: Props) {
  const { dismissed, confirmed, dismiss, confirm, reset, resetAll } = useSubscriptionOverrides();
  const [showReview, setShowReview] = useState(true);
  const [showDismissed, setShowDismissed] = useState(false);

  const groups = useMemo(
    () => groupSubscriptions(subscriptions, { dismissed, confirmed }),
    [subscriptions, dismissed, confirmed],
  );

  function remove(sub: DetectedSubscription) {
    dismiss(sub.key);
    if (selected?.key === sub.key) onSelect(null);
  }

  if (subscriptions.length === 0) {
    return (
      <EmptyNote>
        Nothing repeats yet. We look for the same merchant charging a steady amount on a steady
        cycle — two charges are enough to raise a question here, three on the same day of the month
        put it straight on the calendar.
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
          {groups.review.length > 0
            ? "Nothing is on the calendar yet — none of the repeats we found are clear-cut enough to schedule on their own. Look through the review list below and track the ones you actually pay for."
            : "Nothing is billing right now. Every recurrence we found has been struck off, so the calendar is clear."}
        </EmptyNote>
      )}

      {groups.active.length > 0 ? (
        <>
          <hr className="hairline" />
          <SubscriptionTable
            subscriptions={groups.active}
            selected={selected}
            confirmed={confirmed}
            onSelect={onSelect}
            onDismiss={remove}
          />
        </>
      ) : null}

      {groups.review.length > 0 ? (
        <GroupDisclosure
          open={showReview}
          onToggle={() => setShowReview((v) => !v)}
          label={`${groups.review.length} to review — subscriptions?`}
          hint="These repeat, but not clearly enough to schedule on their own: too few charges yet, a billing date that wanders, or a cycle that stopped a while back. Track one and it goes straight on the calendar."
        >
          <ul className="divide-y divide-border border-y border-border">
            {groups.review.map((sub) => (
              <li key={sub.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => onSelect(selected?.key === sub.key ? null : sub)}
                    className="link-underline text-left text-[13.5px] font-medium"
                  >
                    {sub.service}
                  </button>
                  <p className="money mt-1 text-[11.5px] text-muted-foreground">
                    ${formatMoney(sub.amount)} {sub.cadence} · {reviewNote(sub)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <Button type="button" size="sm" variant="outline" onClick={() => confirm(sub.key)}>
                    <Check className="h-3.5 w-3.5" />
                    Track it
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => remove(sub)}>
                    <Ban className="h-3.5 w-3.5" />
                    Not a subscription
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
              onClick={resetAll}
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
                <Button type="button" size="sm" variant="ghost" onClick={() => reset(sub.key)}>
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
  confirmed,
  onSelect,
  onDismiss,
}: {
  subscriptions: DetectedSubscription[];
  selected: DetectedSubscription | null;
  confirmed: Set<string>;
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
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-display text-lg leading-none">{sub.service}</span>
                  {confirmed.has(sub.key) ? (
                    <Badge
                      variant="ochre"
                      title={`You confirmed this one. Last charge on record: ${formatDate(
                        sub.lastChargeDate,
                      )}`}
                    >
                      Kept by you
                    </Badge>
                  ) : sub.confidence === "high" ? (
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

/** Bank scaffolding under the friendly name — never the raw "Value Date … Card xx". */
function BankDescriptor({ raw, display }: { raw: string; display: string }) {
  const cleaned = cleanMerchantLabel(raw);
  if (!cleaned || cleaned.toLowerCase() === display.toLowerCase()) return null;
  return (
    <div className="truncate font-mono text-[11px] text-muted-foreground" title={raw}>
      {cleaned}
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
                <BankDescriptor raw={row.merchantRaw} display={row.merchantDisplay} />
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
