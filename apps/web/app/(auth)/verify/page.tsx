import Link from "next/link";
import { AuthLayoutCard } from "@/features/auth/auth-layout-card";
import { Button } from "@/components/ui/button";

export default function VerifyPage() {
  return (
    <AuthLayoutCard
      eyebrow="One more step"
      title="Check your email"
      description="We sent a verification link. Confirm your account, then come back and sign in."
    >
      <div className="space-y-5">
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Nothing in your inbox? Check spam or junk, then retry sign-up with the same address.
        </p>
        <Button asChild className="w-full">
          <Link href="/signin">Back to sign in</Link>
        </Button>
      </div>
    </AuthLayoutCard>
  );
}
