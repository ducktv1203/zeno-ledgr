import { AuthLayoutCard } from "@/features/auth/auth-layout-card";
import { SignUpForm } from "@/features/auth/sign-up-form";

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <AuthLayoutCard
        title="Create account"
        description="Set your account password, then confirm your email."
      >
        <SignUpForm />
      </AuthLayoutCard>
    </main>
  );
}

