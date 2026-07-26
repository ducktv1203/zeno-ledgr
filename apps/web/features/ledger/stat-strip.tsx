import { formatMoney } from "@/lib/format";

type Stat = {
  label: string;
  value: string;
  note?: string;
  accent?: boolean;
};

type Props = {
  paymentCount: number;
  totalVolume: number;
  subscriptionCount: number;
  monthlyRecurring: number;
  statementCount: number;
};

export function StatStrip({
  paymentCount,
  totalVolume,
  subscriptionCount,
  monthlyRecurring,
  statementCount,
}: Props) {
  const stats: Stat[] = [
    {
      label: "Payments",
      value: paymentCount.toLocaleString(),
      note: `${statementCount} statement${statementCount === 1 ? "" : "s"}`,
    },
    {
      label: "Total volume",
      value: `$${formatMoney(totalVolume)}`,
      note: "sum of visible rows",
    },
    {
      label: "Subscriptions",
      value: subscriptionCount.toLocaleString(),
      note: "recurring merchants",
    },
    {
      label: "Monthly recurring",
      value: `$${formatMoney(monthlyRecurring)}`,
      note: "normalised per month",
      accent: true,
    },
  ];

  return (
    <section className="grid gap-px border-y border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-background px-1 py-5 lg:px-5 lg:first:pl-1">
          <p className="eyebrow">{stat.label}</p>
          <p
            className={`figure mt-2.5 text-[2rem] leading-none ${
              stat.accent ? "text-oxblood" : ""
            }`}
          >
            {stat.value}
          </p>
          {stat.note ? (
            <p className="mt-1.5 text-[11.5px] text-muted-foreground">{stat.note}</p>
          ) : null}
        </div>
      ))}
    </section>
  );
}
