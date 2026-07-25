import { AuthLayoutCard } from "@/features/auth/auth-layout-card";
import { SignInForm } from "@/features/auth/sign-in-form";

export default function SignInPage() {
  return (
    <main className="mx-auto grid min-h-screen max-w-6xl items-center gap-8 p-6 lg:grid-cols-[1fr_440px]">
      <section className="section-shell hidden lg:block">
        <p className="text-muted-foreground text-xs uppercase tracking-[0.2em]">ZenoLedgr</p>
        <h2 className="mt-3 text-3xl font-semibold leading-tight">
          Access the privacy
          <br />
          operations console
        </h2>
        <p className="text-muted-foreground mt-4 max-w-lg text-sm leading-relaxed">
          Your identity is verified via Supabase Auth. Financial payload decryption remains
          local, and ledger visibility appears only after unlocking your session key.
        </p>
      </section>
      <AuthLayoutCard
        title="Sign in"
        description="Authenticate with Supabase, then unlock your local encryption session."
      >
        <SignInForm />
      </AuthLayoutCard>
    </main>
  );
}

