import { AuthLayoutCard } from "@/features/auth/auth-layout-card";
import { SignUpForm } from "@/features/auth/sign-up-form";

export default function SignUpPage() {
  return (
    <AuthLayoutCard
      eyebrow="New ledger"
      title="Create account"
      description="Set an account password now. You'll choose the master password that encrypts your ledger once you're inside."
    >
      <SignUpForm />
    </AuthLayoutCard>
  );
}
