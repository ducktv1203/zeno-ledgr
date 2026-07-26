"use client";

import { useState } from "react";
import { BookLock, KeyRound } from "lucide-react";

import { PasswordField } from "@/components/password-field";
import { ErrorNote } from "@/components/section";
import { Button } from "@/components/ui/button";

type Props = {
  saltReady: boolean;
  onUnlock: (masterPassword: string) => Promise<void>;
};

/**
 * The "closed book" screen. Until the master password derives a key there is
 * nothing readable in the ledger, so this takes over the page instead of
 * scattering "unlock to continue" notes through every section.
 */
export function VaultPanel({ saltReady, onUnlock }: Props) {
  const [masterPassword, setMasterPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!saltReady) return;
    setError(null);
    setBusy(true);
    try {
      await onUnlock(masterPassword);
      setMasterPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unlock failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rise grid gap-10 lg:grid-cols-[1fr_360px] lg:gap-16">
      <div className="space-y-6">
        <p className="eyebrow flex items-center gap-2">
          <BookLock className="h-3.5 w-3.5" />
          Ledger sealed
        </p>
        <h1 className="font-display text-[2.5rem] leading-[1.08] sm:text-5xl">
          Enter your master
          <br />
          password to open
          <br />
          <em className="italic text-oxblood">the book.</em>
        </h1>
        <p className="max-w-prose text-[14px] leading-relaxed text-muted-foreground">
          This password never leaves the browser. It derives the AES key that decrypts your rows
          for this tab only — lock the session or close the tab and the key is gone.
        </p>
      </div>

      <form className="panel h-fit space-y-5 p-5" onSubmit={submit}>
        <div className="space-y-1">
          <p className="eyebrow">Session key</p>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Same password you used on your first import.
          </p>
        </div>

        <PasswordField
          id="master-password"
          label="Master password"
          value={masterPassword}
          onChange={setMasterPassword}
          required
        />

        {error ? <ErrorNote>{error}</ErrorNote> : null}

        {!saltReady ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Fetching your salt…
          </p>
        ) : null}

        <Button type="submit" size="lg" className="w-full" disabled={!saltReady || busy}>
          <KeyRound className="h-4 w-4" />
          {busy ? "Deriving key…" : "Unlock ledger"}
        </Button>
      </form>
    </div>
  );
}
