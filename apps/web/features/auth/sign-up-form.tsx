"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight } from "lucide-react";

import { PasswordField } from "@/components/password-field";
import { ErrorNote } from "@/components/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthClient } from "@/features/auth/use-auth";

function isLocalAuthMode(): boolean {
  const mode = (process.env.NEXT_PUBLIC_AUTH_MODE ?? "local").toLowerCase();
  return mode === "local" || mode === "docker";
}

export function SignUpForm() {
  const router = useRouter();
  const supabase = useAuthClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setError("Auth is not configured.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Password and confirm password do not match.");
      return;
    }

    setLoading(true);
    setError(null);
    const { error: authError } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    const local = isLocalAuthMode();
    router.push(local ? "/dashboard" : "/verify");
    if (local) router.refresh();
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="signup-email">Email</Label>
        <Input
          id="signup-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>

      <PasswordField
        id="signup-password"
        label="Password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        required
        hint="At least 8 characters."
      />

      <PasswordField
        id="signup-confirm-password"
        label="Confirm password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        autoComplete="new-password"
        required
      />

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <Button type="submit" disabled={loading} className="w-full" size="lg">
        {loading ? "Creating account…" : "Create account"}
        {loading ? null : <ArrowRight className="h-4 w-4" />}
      </Button>

      <p className="text-[13px] text-muted-foreground">
        Already have an account?{" "}
        <Link className="link-underline font-medium text-foreground" href="/signin">
          Sign in
        </Link>
      </p>
    </form>
  );
}
