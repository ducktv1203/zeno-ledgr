"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { generateSalt, verifyEncryptDecryptLoop } from "@/lib/crypto";

export default function DevCryptoPage() {
  const [result, setResult] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  if (process.env.NODE_ENV === "production") {
    return (
      <main className="p-10">
        <p className="text-muted-foreground">Not available in production.</p>
      </main>
    );
  }

  async function run() {
    setRunning(true);
    setResult(null);
    try {
      const salt = await generateSalt();
      const ok = await verifyEncryptDecryptLoop("dev-test-password", salt);
      setResult(ok ? "Encrypt/decrypt loop OK" : "Loop failed");
    } catch (e) {
      setResult(e instanceof Error ? e.message : "Error");
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="mx-auto max-w-lg p-10">
      <Card className="border-zinc-800 bg-zinc-950/50">
        <CardHeader>
          <CardTitle>Crypto self-test</CardTitle>
          <CardDescription>
            PBKDF2 + AES-GCM round-trip (development only).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button type="button" onClick={() => void run()} disabled={running}>
            {running ? "Running…" : "Run verifyEncryptDecryptLoop"}
          </Button>
          {result ? (
            <p className="font-mono text-sm text-muted-foreground">{result}</p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
