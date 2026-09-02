"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

// Two steps, one page:
//
//   details  →  code  →  chambers created, signed in
//
// Nothing is written to the database on step 1 — the chambers details ride
// along inside the one-time-code record and are only spent once the address
// has proved itself. An abandoned sign-up therefore leaves nothing behind
// for the global admin to clean up.

type Step = "details" | "code";

const CODE_LENGTH = 6;

export default function SignupForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("details");

  const [chambersName, setChambersName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [code, setCode] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailTaken, setEmailTaken] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const codeRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  async function startSignup(resend = false) {
    setError(null);
    setEmailTaken(false);
    setNote(null);
    setBusy(true);
    try {
      const res = await fetch("/api/account/signup/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chambersName: chambersName.trim(),
          contactName: contactName.trim(),
          phone: phone.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Couldn't start that sign-up.");
        setEmailTaken(data?.code === "email_taken");
        if (typeof data?.retryAfterSeconds === "number") {
          setCooldown(data.retryAfterSeconds);
        }
        return;
      }
      setCooldown(Number(data?.retryAfterSeconds) || 60);
      setStep("code");
      setNote(
        resend
          ? "A fresh code is on its way."
          : `We've emailed a six-digit code to ${email.trim().toLowerCase()}.`
      );
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyAndEnter() {
    setError(null);
    setNote(null);
    setBusy(true);
    try {
      const res = await fetch("/api/account/signup/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: code.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "That code doesn't match.");
        setBusy(false);
        return;
      }
      // The chambers exists and we still hold the password they chose —
      // walk them in rather than asking them to sign in immediately after
      // signing up.
      const signInRes = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });
      if (!signInRes || signInRes.error) {
        router.push("/login");
        return;
      }
      router.push("/post-login");
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
      setBusy(false);
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    if (step === "details") void startSignup();
    else void verifyAndEnter();
  }

  const detailsReady =
    chambersName.trim().length > 0 &&
    contactName.trim().length > 0 &&
    phone.replace(/\D/g, "").length >= 8 &&
    /^\S+@\S+\.\S+$/.test(email.trim()) &&
    password.length >= 8;
  const canSubmit =
    step === "details"
      ? detailsReady
      : code.replace(/\D/g, "").length === CODE_LENGTH;

  return (
    <form onSubmit={onSubmit} className="space-y-7" noValidate>
      {step === "details" ? (
        <>
          <Field
            id="chambersName"
            label="Chambers Name"
            index="01"
            value={chambersName}
            onChange={setChambersName}
            placeholder="Nambiraj Law Dynasty LLP"
            autoComplete="organization"
          />
          <Field
            id="contactName"
            label="Your Name"
            index="02"
            value={contactName}
            onChange={setContactName}
            placeholder="K. S. Nagendhran"
            autoComplete="name"
          />
          <Field
            id="phone"
            label="Phone"
            index="03"
            type="tel"
            value={phone}
            onChange={setPhone}
            placeholder="99449 93093"
            autoComplete="tel"
          />
          <Field
            id="email"
            label="Office Email"
            index="04"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="advocate@chambers.in"
            autoComplete="email"
          />
          <Field
            id="password"
            label="Choose a Password"
            index="05"
            type={showPw ? "text" : "password"}
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            autoComplete="new-password"
            right={
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft transition-colors hover:text-ink"
              >
                {showPw ? "Hide" : "Show"}
              </button>
            }
          />
          <p className="font-body text-[13px] italic leading-7 text-ink-soft">
            At least 8 characters. This becomes the office admin account —
            you can add the rest of chambers once you&rsquo;re in.
          </p>
        </>
      ) : (
        <div>
          <div className="flex items-baseline justify-between">
            <label
              htmlFor="code"
              className="font-mono text-[11px] uppercase tracking-[0.22em] text-brass-deep"
            >
              <span className="mr-2 text-brass">06</span>
              Six-digit code
            </label>
            <button
              type="button"
              onClick={() => {
                setStep("details");
                setCode("");
                setNote(null);
                setError(null);
              }}
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft transition-colors hover:text-ink"
            >
              Edit details
            </button>
          </div>
          <div className="relative mt-3">
            <input
              id="code"
              ref={codeRef}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={CODE_LENGTH}
              value={code}
              onChange={(e) =>
                setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))
              }
              placeholder="••••••"
              className="peer w-full bg-transparent px-0 py-2.5 font-mono text-[30px] tracking-[0.5em] text-ink placeholder:text-ink-soft/30 outline-none"
            />
            <div className="absolute inset-x-0 bottom-0 h-px bg-ink/25 transition-colors peer-focus:bg-ink/50" />
            <div className="absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 bg-brass transition-transform duration-300 peer-focus:scale-x-100" />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={cooldown > 0 || busy}
              onClick={() => void startSignup(true)}
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-brass-deep transition-colors hover:text-ink disabled:cursor-not-allowed disabled:text-ink-soft/60 disabled:hover:text-ink-soft/60"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </button>
            <span className="text-rule">·</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft">
              Sent to {email.trim().toLowerCase()}
            </span>
          </div>
        </div>
      )}

      {note && !error ? (
        <div className="border border-brass/40 bg-brass/5 px-4 py-3">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-brass-deep">
            <span>✓</span>
            <span>Filed</span>
          </div>
          <p className="mt-2 font-body text-[14px] italic leading-7 text-ink-2">
            {note}
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="border border-vermillion/40 bg-vermillion/5 px-4 py-3">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-vermillion">
            <span>✗</span>
            <span>Notice from the bench</span>
          </div>
          <p className="mt-2 font-body text-[14px] italic leading-7 text-ink-2">
            {error}
          </p>
          {emailTaken ? (
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em]">
              <Link
                href="/login"
                className="text-ink underline-offset-4 hover:underline"
              >
                Sign in
              </Link>
              <span className="mx-2 text-rule">·</span>
              <Link
                href="/forgot-password"
                className="text-brass-deep underline-offset-4 hover:underline"
              >
                Reset password
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={busy || !canSubmit}
        className="group relative inline-flex w-full items-center justify-center gap-3 border border-ink bg-ink px-7 py-4 font-mono text-[12px] uppercase tracking-[0.18em] text-paper transition-colors hover:bg-ink-2 disabled:opacity-50"
      >
        {busy ? (
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-brass" />
            <span>{step === "details" ? "Sending code…" : "Opening chambers…"}</span>
          </span>
        ) : (
          <>
            {step === "details" ? "Email me a code" : "Verify & open chambers"}
            <span className="text-brass transition-transform duration-200 group-hover:translate-x-1">
              →
            </span>
          </>
        )}
      </button>
    </form>
  );
}

/* ─── Field ─── */

function Field({
  id,
  label,
  index,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  right,
}: {
  id: string;
  label: string;
  index: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  right?: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label
          htmlFor={id}
          className="font-mono text-[11px] uppercase tracking-[0.22em] text-brass-deep"
        >
          <span className="mr-2 text-brass">{index}</span>
          {label}
        </label>
        {right}
      </div>
      <div className="relative mt-3">
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="peer w-full bg-transparent px-0 py-2.5 font-body text-[18px] text-ink placeholder:text-ink-soft/40 outline-none"
        />
        <div className="absolute inset-x-0 bottom-0 h-px bg-ink/25 transition-colors peer-focus:bg-ink/50" />
        <div className="absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 bg-brass transition-transform duration-300 peer-focus:scale-x-100" />
      </div>
    </div>
  );
}
