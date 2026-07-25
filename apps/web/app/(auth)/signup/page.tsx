import { AuthLayoutCard } from "@/features/auth/auth-layout-card";
import { SignUpForm } from "@/features/auth/sign-up-form";

export default function SignUpPage() {
  return (
    <main className="mx-auto grid min-h-screen max-w-6xl items-center gap-8 p-6 lg:grid-cols-[1fr_440px]">
      <section className="section-shell hidden lg:block">
        <p className="text-muted-foreground text-xs uppercase tracking-[0.2em]">Onboarding</p>
        <h2 className="mt-3 text-3xl font-semibold leading-tight">
          Create your secure
          <br />
          ledger identity
        </h2>
        <p className="text-muted-foreground mt-4 max-w-lg text-sm leading-relaxed">
          After account verification, you will unlock encryption locally with your master
          password. Server infrastructure stores encrypted blobs only.
        </p>
      </section>
      <AuthLayoutCard
        title="Create account"
        description="Set your account password, then confirm your email."
      >
        <SignUpForm />
      </AuthLayoutCard>
    </main>
  );
}

