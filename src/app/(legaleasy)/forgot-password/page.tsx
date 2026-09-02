import type { Metadata } from "next";
import Link from "next/link";
import ForgotPasswordForm from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Reset your password — Legalezi",
  description:
    "Lost the key to chambers? Verify your office email and set a new password.",
};

export default function ForgotPasswordPage() {
  return (
    <section className="relative overflow-hidden">
      {/* paper grain */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05] paper-grain"
      />
      {/* brass glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 top-32 h-[420px] w-[420px] rounded-full opacity-[0.18]"
        style={{
          background:
            "radial-gradient(closest-side, rgba(182,139,60,0.55), transparent 70%)",
        }}
      />

      {/* upper masthead bar */}
      <div className="relative border-b border-rule/40">
        <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-2 px-6 py-3 md:px-10">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
            <span className="text-brass-deep">Vol. I · No. 01</span>
            <span className="mx-2 text-rule">·</span>
            <span>Lost Key</span>
          </div>
          <div className="hidden font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft md:block">
            Verified by email · One-time code
          </div>
        </div>
      </div>

      <div className="relative mx-auto grid max-w-[1320px] grid-cols-1 gap-12 px-6 pb-24 pt-16 md:grid-cols-12 md:gap-16 md:px-10 md:pb-32 md:pt-24">
        {/* LEFT — the form */}
        <div className="md:col-span-7">
          <div
            className="rise font-mono text-[11px] uppercase tracking-[0.22em] text-brass-deep"
            style={{ animationDelay: "0.05s" }}
          >
            <span className="mr-3 inline-block h-px w-8 bg-brass align-middle" />
            Private Wing — § VIII
          </div>

          <h1
            className="rise mt-6 font-display text-[56px] font-medium leading-[1.02] tracking-[-0.025em] text-ink md:text-[88px]"
            style={{ animationDelay: "0.15s" }}
          >
            Cut a <span className="italic text-ink-2">new key.</span>
          </h1>

          <p
            className="rise mt-6 max-w-md font-body text-[17px] leading-8 text-ink-2"
            style={{ animationDelay: "0.28s" }}
          >
            We&rsquo;ll email a one-time code to the address you sign in with.
            Enter it here and set a new password — nobody else needs to be
            involved.
          </p>

          <div className="rise mt-12 max-w-lg" style={{ animationDelay: "0.4s" }}>
            <ForgotPasswordForm />
          </div>

          <div
            className="rise mt-12 max-w-lg border-t border-rule/40 pt-6"
            style={{ animationDelay: "0.7s" }}
          >
            <p className="font-body text-[14px] italic leading-7 text-ink-soft">
              Remembered it after all?{" "}
              <Link
                href="/login"
                className="not-italic font-mono text-[11px] uppercase tracking-[0.18em] text-ink underline-offset-4 hover:underline"
              >
                Back to sign in
              </Link>
              .
            </p>
          </div>
        </div>

        {/* RIGHT — editorial side panel */}
        <aside
          className="rise relative md:col-span-4 md:col-start-9"
          style={{ animationDelay: "0.5s" }}
        >
          <div className="md:sticky md:top-32">
            <div className="flex items-center justify-end">
              <div className="flex h-24 w-24 -rotate-6 items-center justify-center rounded-full border-2 border-vermillion/60 bg-paper shadow-sm">
                <div className="text-center font-mono text-[9px] uppercase leading-tight tracking-[0.22em] text-vermillion">
                  <div>Sub</div>
                  <div className="my-1 mx-auto h-px w-7 bg-vermillion/50" />
                  <div>Poena</div>
                  <div className="mt-0.5 text-[7px]">2026</div>
                </div>
              </div>
            </div>

            <ol className="mt-14 space-y-8">
              {STEPS.map((s) => (
                <li key={s.index}>
                  <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-brass-deep">
                    {s.index}
                  </div>
                  <div className="mt-2 font-display text-[22px] leading-tight tracking-[-0.01em] text-ink">
                    {s.title}
                  </div>
                  <p className="mt-2 font-body text-[14px] leading-7 text-ink-soft">
                    {s.body}
                  </p>
                </li>
              ))}
            </ol>

            <div className="mt-16 border-t border-rule/40 pt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
              <div>Codes expire in 10 minutes</div>
              <div className="mt-1">Never share one with anyone</div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

const STEPS = [
  {
    index: "01",
    title: "Your office email",
    body: "The same address you sign in with. If it's on record, a six-digit code is on its way.",
  },
  {
    index: "02",
    title: "The code",
    body: "Six digits, good for ten minutes. Check the spam folder if it isn't in the inbox.",
  },
  {
    index: "03",
    title: "A new password",
    body: "At least eight characters. You'll be signed in the moment it's set.",
  },
];
