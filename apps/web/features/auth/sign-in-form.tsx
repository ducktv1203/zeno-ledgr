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

export function SignInForm() {
  const router = useRouter();
  const supabase = useAuthClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setError("Auth is not configured.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label htmlFor="signin-email">Email</Label>
        <Input
          id="signin-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>

      <PasswordField
        id="signin-password"
        label="Password"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
        required
      />

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <Button type="submit" disabled={loading} className="w-full" size="lg">
        {loading ? "Signing in…" : "Sign in"}
        {loading ? null : <ArrowRight className="h-4 w-4" />}
      </Button>

      <p className="text-[13px] text-muted-foreground">
        Need an account?{" "}
        <Link className="link-underline font-medium text-foreground" href="/signup">
          Create one
        </Link>
      </p>
    </form>
  );
}
