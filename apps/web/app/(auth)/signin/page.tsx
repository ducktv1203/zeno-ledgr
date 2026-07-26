import { AuthLayoutCard } from "@/features/auth/auth-layout-card";
import { SignInForm } from "@/features/auth/sign-in-form";

export default function SignInPage() {
  return (
    <AuthLayoutCard
      eyebrow="Welcome back"
      title="Sign in"
      description="Authenticate first, then unlock your ledger with your master password."
    >
      <SignInForm />
    </AuthLayoutCard>
  );
}
