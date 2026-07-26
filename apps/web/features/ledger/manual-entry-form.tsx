"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { ErrorNote } from "@/components/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  onSubmit: (entry: { merchantRaw: string; amount: string; date: string }) => Promise<void>;
};

export function ManualEntryForm({ onSubmit }: Props) {
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ merchantRaw: merchant, amount, date });
      setMerchant("");
      setAmount("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that entry");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="grid gap-4 sm:grid-cols-[1.6fr_0.7fr_0.9fr]">
        <div className="space-y-2">
          <Label htmlFor="entry-merchant">Merchant</Label>
          <Input
            id="entry-merchant"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder="NETFLIX.COM"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="entry-amount">Amount</Label>
          <Input
            id="entry-amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="18.99"
            inputMode="decimal"
            className="money"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="entry-date">Date</Label>
          <Input
            id="entry-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="money"
            required
          />
        </div>
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <Button type="submit" disabled={saving}>
        <Plus className="h-4 w-4" />
        {saving ? "Encrypting…" : "Encrypt and add"}
      </Button>
    </form>
  );
}
