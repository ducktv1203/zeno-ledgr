import type { CashFlow } from "@/lib/crypto";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  amount: string;
  flow: CashFlow;
  className?: string;
};

/**
 * Colour the figure by cash direction — moss for money in, oxblood for money out.
 * Uses the stored/inferred `flow` flag (debit vs credit), not a balance walk.
 */
export function FlowAmount({ amount, flow, className }: Props) {
  const moneyIn = flow === "in";
  return (
    <span
      className={cn(
        "money tabular-nums",
        moneyIn ? "text-moss" : "text-oxblood",
        className,
      )}
      title={moneyIn ? "Money in" : "Money out"}
    >
      <span className="sr-only">{moneyIn ? "Money in" : "Money out"} </span>
      {moneyIn ? "+" : "−"}${formatMoney(amount)}
    </span>
  );
}
