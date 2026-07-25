import Link from "next/link";
import { AuthLayoutCard } from "@/features/auth/auth-layout-card";
import { Button } from "@/components/ui/button";

export default function VerifyPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl items-center justify-center p-6">
      <AuthLayoutCard
        title="Check your email"
        description="We sent a verification link. Confirm your account, then return to sign in."
      >
        <div className="space-y-3">
          <p className="text-muted-foreground text-sm">
            If you do not see the email, check spam/junk and retry sign-up with the same
            address.
          </p>
          <Button asChild className="w-full">
            <Link href="/signin">Back to sign in</Link>
          </Button>
        </div>
      </AuthLayoutCard>
    </main>
  );
}

