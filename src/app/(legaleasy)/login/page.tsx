import type { Metadata } from "next";
import Link from "next/link";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in — Legalezi",
  description:
    "Welcome back to chambers. Sign in to pick up where the day left you.",
};

export default function LoginPage() {
  return (
    <section className="relative overflow-hidden">
      {/* paper grain */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.05] paper-grain"
      />
      {/* brass glow, top-left this time */}
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
            <span>Private Wing</span>
          </div>
          <div className="hidden font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft md:block">
            Restricted · Members Only · By Invitation
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
            Private Wing — § VII
          </div>

          <h1
            className="rise mt-6 font-display text-[56px] font-medium leading-[1.02] tracking-[-0.025em] text-ink md:text-[96px]"
            style={{ animationDelay: "0.15s" }}
          >
            Open <span className="italic text-ink-2">the file.</span>
          </h1>

          <p
            className="rise mt-6 max-w-md font-body text-[17px] leading-8 text-ink-2"
            style={{ animationDelay: "0.28s" }}
          >
            Welcome back to chambers. Sign in to pick up where the day left
            you — pending dates, the cause-list, your senior-desk notes.
          </p>

          <div
            className="rise mt-12 max-w-lg"
            style={{ animationDelay: "0.4s" }}
          >
            <LoginForm />
          </div>

          <div
            className="rise mt-12 max-w-lg border-t border-rule/40 pt-6"
            style={{ animationDelay: "0.7s" }}
          >
            <p className="font-body text-[14px] italic leading-7 text-ink-soft">
              No chambers here yet?{" "}
              <Link
                href="/signup"
                className="not-italic font-mono text-[11px] uppercase tracking-[0.18em] text-ink underline-offset-4 hover:underline"
              >
                Sign up
              </Link>{" "}
              — seven days free, no card. Already in an office? Ask your
              administrator to add you, or write to{" "}
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

        {/* RIGHT — editorial side panel */}
        <aside
          className="rise relative md:col-span-4 md:col-start-9"
          style={{ animationDelay: "0.5s" }}
        >
          <div className="md:sticky md:top-32">
            {/* Seal */}
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

            {/* Vol info */}
            <div className="mt-14 font-mono text-[10px] uppercase tracking-[0.22em] text-brass-deep">
              <div>Volume I</div>
              <div className="mt-1">Number 01</div>
              <div className="mt-4 h-px w-16 bg-brass" />
            </div>

            {/* Epigraph */}
            <blockquote className="mt-10">
              <p className="font-display text-[28px] leading-[1.22] tracking-[-0.01em] text-ink md:text-[32px]">
                <span className="italic">&ldquo;Every file</span>
                <br />
                <span className="italic">remembers what</span>
                <br />
                <span className="italic">we forget.&rdquo;</span>
              </p>
              <footer className="mt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
                <span className="text-brass-deep">¶</span> Anon. circular,
                <br />
                City Civil &middot; 1979
              </footer>
            </blockquote>

            {/* Colophon */}
            <div className="mt-16 border-t border-rule/40 pt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-ink-soft">
              <div>Chambers · Bengaluru</div>
              <div className="mt-1">Members Only · MMXXVI</div>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
