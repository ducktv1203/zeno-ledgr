import { AuthLayoutCard } from "@/features/auth/auth-layout-card";
import { SignInForm } from "@/features/auth/sign-in-form";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <AuthLayoutCard
        title="Sign in"
        description="Authenticate with Supabase, then unlock your local encryption session."
      >
        <SignInForm />
      </AuthLayoutCard>
    </main>
  );
}

