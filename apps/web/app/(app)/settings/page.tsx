"use client";

import { useEffect, useState } from "react";
import { KeyRound, Lock, Moon, RotateCcw, Sun } from "lucide-react";

import { Section } from "@/components/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { useAuthClient } from "@/features/auth/use-auth";
import { clearSessionCrypto } from "@/lib/crypto";
import { resetPreferences, usePreferences } from "@/lib/preferences";
import { applyTheme } from "@/lib/theme";
import { useCryptoUnlocked } from "@/lib/use-crypto-status";
import { useTheme } from "@/lib/use-theme";

const AUTO_LOCK_CHOICES = [
  { value: "0", label: "Never" },
  { value: "5", label: "5 min" },
  { value: "15", label: "15 min" },
  { value: "30", label: "30 min" },
  { value: "60", label: "1 hr" },
];

export default function SettingsPage() {
  const { preferences, setPreference } = usePreferences();
  const { theme } = useTheme();
  const unlocked = useCryptoUnlocked();
  const supabase = useAuthClient();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user?.email ?? null);
    });
  }, [supabase]);

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <p className="eyebrow">Settings</p>
        <h1 className="font-display text-4xl leading-tight">Preferences</h1>
        <p className="max-w-prose text-[13px] leading-relaxed text-muted-foreground">
          Everything here is stored in this browser only. None of it is sent to the server, and
          none of it touches your encryption key.
        </p>
      </header>

      <Section
        eyebrow="Appearance"
        title="How the ledger looks"
        description="Applies immediately and persists on this device."
      >
        <div className="divide-y divide-border">
          <Row label="Theme" hint="Dark is the default.">
            <Segmented
              label="Theme"
              value={theme}
              onChange={(value) => applyTheme(value)}
              options={[
                {
                  value: "light",
                  label: (
                    <>
                      <Sun className="h-3 w-3" />
                      Light
                    </>
                  ),
                },
                {
                  value: "dark",
                  label: (
                    <>
                      <Moon className="h-3 w-3" />
                      Dark
                    </>
                  ),
                },
              ]}
            />
          </Row>

          <Row label="Default payments view" hint="Which density the payments table opens in.">
            <Segmented
              label="Default payments view"
              value={preferences.paymentsView}
              onChange={(value) => setPreference("paymentsView", value)}
              options={[
                { value: "table", label: "Comfortable" },
                { value: "compact", label: "Compact" },
                { value: "list", label: "List" },
              ]}
            />
          </Row>

          <Row label="Rows per page" hint="Starting page size for payment history.">
            <Segmented
              label="Rows per page"
              value={preferences.paymentsPageSize}
              onChange={(value) => setPreference("paymentsPageSize", value)}
              options={[
                { value: "25", label: "25" },
                { value: "50", label: "50" },
                { value: "100", label: "100" },
                { value: "all", label: "All" },
              ]}
            />
          </Row>

          <Row
            label="Show raw bank descriptors"
            hint="Prints the untouched statement text under each cleaned merchant name."
          >
            <Switch
              label="Show raw bank descriptors"
              checked={preferences.showRawDescriptors}
              onCheckedChange={(checked) => setPreference("showRawDescriptors", checked)}
            />
          </Row>
        </div>
      </Section>

      <Section
        eyebrow="Security"
        title="Key and session"
        description="Your master password derives an AES-256-GCM key via PBKDF2 (600,000 iterations). It lives in this tab's memory only — never in storage, never on the server."
        aside={
          unlocked ? (
            <Badge variant="success">Key in memory</Badge>
          ) : (
            <Badge variant="outline">Locked</Badge>
          )
        }
      >
        <div className="divide-y divide-border">
          <Row
            label="Auto-lock when idle"
            hint="Discards the key after this much inactivity. You will need your master password again."
          >
            <Segmented
              label="Auto-lock when idle"
              value={String(preferences.autoLockMinutes)}
              onChange={(value) => setPreference("autoLockMinutes", Number.parseInt(value, 10))}
              options={AUTO_LOCK_CHOICES}
            />
          </Row>

          <Row label="Lock now" hint="Drops the key from memory without signing out.">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!unlocked}
              onClick={() => clearSessionCrypto()}
            >
              <Lock className="h-3.5 w-3.5" />
              {unlocked ? "Lock session" : "Already locked"}
            </Button>
          </Row>

          <Row label="Signed in as" hint="Used for authentication only — it is never part of the ciphertext.">
            <span className="money text-[12.5px] text-muted-foreground">{email ?? "—"}</span>
          </Row>
        </div>
      </Section>

      <Section
        eyebrow="Reset"
        title="Start over"
        description="Clears the preferences above. Your ledger, statements and encryption key are untouched."
      >
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={() => resetPreferences()}>
            <RotateCcw className="h-3.5 w-3.5" />
            Restore defaults
          </Button>
          <p className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
            <KeyRound className="h-3.5 w-3.5" />
            Deleting a statement on the ledger page also deletes every row imported from it.
          </p>
        </div>
      </Section>
    </div>
  );
}

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0 max-w-prose space-y-1">
        <p className="text-[13.5px] font-medium">{label}</p>
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">{hint}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
