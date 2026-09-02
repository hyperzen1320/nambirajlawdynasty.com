import type { Metadata } from "next";
import Link from "next/link";
import SignupForm from "./SignupForm";
import { SELF_SIGNUP_TRIAL_DAYS, getTrialAllowance } from "@/lib/signup";

export const metadata: Metadata = {
  title: "Sign up — Legalezi",
  description:
    "Open your chambers on Legalezi. Seven days free, no card, the whole office included.",
};

// The page prints the allowance the Trial plan actually grants, read from
// the same catalogue the sign-up writes from — so the promise on this page
// can never drift from what a new chambers receives.
export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const { seatLimit, matterLimit } = await getTrialAllowance();

  const included = [
    "Case Vault, Hearing Track and the pending-dates register",
    "Court Hub, Client Crew and the Work Flow board",
    "Senior Desk — the whole office in one room",
    "Word, Excel and PDF export on everything",
    `Up to ${seatLimit} ${seatLimit === 1 ? "person" : "people"} in chambers · ${matterLimit} matters`,
    "Mobile and web, same account",
  ];

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
        className="pointer-events-none absolute -right-40 top-24 h-[460px] w-[460px] rounded-full opacity-[0.18]"
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
            <span>Admissions</span>
          </div>
          <div className="hidden font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft md:block">
            {SELF_SIGNUP_TRIAL_DAYS} days free · No card required
          </div>
        </div>
      </div>

      <div className="relative mx-auto grid max-w-[1320px] grid-cols-1 gap-12 px-6 pb-24 pt-16 md:grid-cols-12 md:gap-16 md:px-10 md:pb-32 md:pt-20">
        {/* LEFT — the form */}
        <div className="md:col-span-7">
          <div
            className="rise font-mono text-[11px] uppercase tracking-[0.22em] text-brass-deep"
            style={{ animationDelay: "0.05s" }}
          >
            <span className="mr-3 inline-block h-px w-8 bg-brass align-middle" />
            Admissions — § I
          </div>

          <h1
            className="rise mt-6 font-display text-[52px] font-medium leading-[1.02] tracking-[-0.025em] text-ink md:text-[84px]"
            style={{ animationDelay: "0.15s" }}
          >
            Open <span className="italic text-ink-2">your chambers.</span>
          </h1>

          <p
            className="rise mt-6 max-w-md font-body text-[17px] leading-8 text-ink-2"
            style={{ animationDelay: "0.28s" }}
          >
            {SELF_SIGNUP_TRIAL_DAYS} days on the house — the full cabinet,
            the cause-list, the senior desk, your whole office. No card, no
            call, nothing to cancel.
          </p>

          <div className="rise mt-10 max-w-lg" style={{ animationDelay: "0.4s" }}>
            <SignupForm />
          </div>

          <div
            className="rise mt-10 max-w-lg border-t border-rule/40 pt-6"
            style={{ animationDelay: "0.7s" }}
          >
            <p className="font-body text-[14px] italic leading-7 text-ink-soft">
              Already have chambers here?{" "}
              <Link
                href="/login"
                className="not-italic font-mono text-[11px] uppercase tracking-[0.18em] text-ink underline-offset-4 hover:underline"
              >
                Sign in
              </Link>
              . Prefer to talk first?{" "}
              <a
                href="mailto:chambers@legalezi.com"
                className="not-italic font-mono text-[11px] uppercase tracking-[0.18em] text-ink underline-offset-4 hover:underline"
              >
                chambers@legalezi.com
              </a>
              .
            </p>
          </div>
        </div>

        {/* RIGHT — what's included */}
        <aside
          className="rise relative md:col-span-4 md:col-start-9"
          style={{ animationDelay: "0.5s" }}
        >
          <div className="md:sticky md:top-32">
            <div className="border border-rule/50 bg-paper-2/60 p-7">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-brass-deep">
                The trial, in full
              </div>
              <div className="mt-4 font-display text-[40px] leading-none tracking-[-0.02em] text-ink">
                {SELF_SIGNUP_TRIAL_DAYS} days
              </div>
              <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-soft">
                Then it simply stops — no charge
              </div>

              <ul className="mt-7 space-y-3.5">
                {included.map((line) => (
                  <li key={line} className="flex gap-3">
                    <span className="mt-[7px] inline-block h-px w-4 shrink-0 bg-brass" />
                    <span className="font-body text-[14px] leading-7 text-ink-2">
                      {line}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <blockquote className="mt-10">
              <p className="font-display text-[26px] leading-[1.22] tracking-[-0.01em] text-ink">
                <span className="italic">&ldquo;Every file</span>
                <br />
                <span className="italic">remembers what</span>
                <br />
                <span className="italic">we forget.&rdquo;</span>
              </p>
              <footer className="mt-5 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
                <span className="text-brass-deep">¶</span> Anon. circular,
                <br />
                City Civil &middot; 1979
              </footer>
            </blockquote>
          </div>
        </aside>
      </div>
    </section>
  );
}
