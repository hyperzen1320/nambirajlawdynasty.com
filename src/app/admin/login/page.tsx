import type { Metadata } from "next";
import Logo from "@/components/Logo";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <Logo size={40} />
          <div>
            <div className="text-[15px] font-semibold tracking-tight">Nambiraj Law Dynasty</div>
            <div className="text-[13px]" style={{ color: "var(--color-admin-fg-muted)" }}>
              Website content manager
            </div>
          </div>
        </div>

        <div
          className="rounded-xl border p-6 shadow-[0_1px_2px_rgba(14,26,31,0.04)]"
          style={{
            backgroundColor: "var(--color-admin-surface)",
            borderColor: "var(--color-admin-border)",
          }}
        >
          <h1 className="text-[18px] font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-[13.5px]" style={{ color: "var(--color-admin-fg-muted)" }}>
            Use the account the site owner created for you in Supabase.
          </p>
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
