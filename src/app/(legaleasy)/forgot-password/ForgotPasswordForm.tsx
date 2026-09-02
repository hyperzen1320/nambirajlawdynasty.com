"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

// Three steps on one page: prove the address, then set the password.
//
//   email  →  code  →  password  →  signed in
//
// The server hands back a signed ticket when the code checks out; that
// ticket (never a local "verified" boolean) is what authorises the write,
// so skipping ahead in the UI gets you nowhere.

type Step = "email" | "code" | "password";

const CODE_LENGTH = 6;

export default function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [ticket, setTicket] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const codeRef = useRef<HTMLInputElement | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);

  // Resend countdown. One interval, cleared on unmount and whenever the
  // count reaches zero.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => {
      setCooldown((c) => (c <= 1 ? 0 : c - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
    if (step === "password") passwordRef.current?.focus();
  }, [step]);

  async function requestCode(resend = false) {
    setError(null);
    setNote(null);
    setBusy(true);
    try {
      const res = await fetch("/api/account/password/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Couldn't send that code. Try again.");
        return;
      }
      setCooldown(Number(data?.retryAfterSeconds) || 60);
      setStep("code");
      setNote(
        data?.throttled
          ? "A code was already sent a moment ago — check your inbox."
          : resend
            ? "A fresh code is on its way."
            : `If ${email.trim().toLowerCase()} is on record, a six-digit code is on its way.`
      );
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    setError(null);
    setNote(null);
    setBusy(true);
    try {
      const res = await fetch("/api/account/password/verify", {
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
        return;
      }
      setTicket(String(data.ticket || ""));
      setStep("password");
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submitPassword() {
    setError(null);
    if (password.length < 8) {
      setError("Your new password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Those two passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/account/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Couldn't set that password.");
        setBusy(false);
        return;
      }
      // The password is in hand, so walk them straight in rather than
      // dropping them back on the sign-in page to type it again.
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
    if (step === "email") void requestCode();
    else if (step === "code") void verifyCode();
    else void submitPassword();
  }

  const canSubmit =
    step === "email"
      ? /^\S+@\S+\.\S+$/.test(email.trim())
      : step === "code"
        ? code.replace(/\D/g, "").length === CODE_LENGTH
        : password.length >= 8 && confirm.length >= 8;

  return (
    <form onSubmit={onSubmit} className="space-y-7" noValidate>
      <StepRail step={step} />

      {step === "email" ? (
        <Field
          id="email"
          label="Office Email"
          index="01"
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          placeholder="advocate@chambers.in"
        />
      ) : null}

      {step === "code" ? (
        <>
          <div>
            <div className="flex items-baseline justify-between">
              <label
                htmlFor="code"
                className="font-mono text-[11px] uppercase tracking-[0.22em] text-brass-deep"
              >
                <span className="mr-2 text-brass">02</span>
                Six-digit code
              </label>
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setNote(null);
                  setError(null);
                }}
                className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft transition-colors hover:text-ink"
              >
                Change email
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
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                disabled={cooldown > 0 || busy}
                onClick={() => void requestCode(true)}
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
        </>
      ) : null}

      {step === "password" ? (
        <>
          <Field
            id="password"
            label="New Password"
            index="03"
            type={showPw ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            inputRef={passwordRef}
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
          <Field
            id="confirm"
            label="Repeat It"
            index="04"
            type={showPw ? "text" : "password"}
            autoComplete="new-password"
            value={confirm}
            onChange={setConfirm}
            placeholder="••••••••"
          />
          <p className="font-body text-[13px] italic leading-7 text-ink-soft">
            At least 8 characters. You&rsquo;ll be signed in as soon as it&rsquo;s
            set.
          </p>
        </>
      ) : null}

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
            <span>
              {step === "email"
                ? "Sending…"
                : step === "code"
                  ? "Checking…"
                  : "Setting…"}
            </span>
          </span>
        ) : (
          <>
            {step === "email"
              ? "Email me a code"
              : step === "code"
                ? "Verify code"
                : "Set password & sign in"}
            <span className="text-brass transition-transform duration-200 group-hover:translate-x-1">
              →
            </span>
          </>
        )}
      </button>
    </form>
  );
}

/* ─── Step rail ─── */

function StepRail({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: "email", label: "Email" },
    { key: "code", label: "Code" },
    { key: "password", label: "Password" },
  ];
  const activeIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="flex items-center gap-3">
      {steps.map((s, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        return (
          <div key={s.key} className="flex items-center gap-3">
            <span
              className={`font-mono text-[10px] uppercase tracking-[0.18em] ${
                active
                  ? "text-ink"
                  : done
                    ? "text-brass-deep"
                    : "text-ink-soft/50"
              }`}
            >
              {done ? "✓ " : ""}
              {s.label}
            </span>
            {i < steps.length - 1 ? (
              <span
                aria-hidden
                className={`inline-block h-px w-6 ${
                  done ? "bg-brass" : "bg-rule"
                }`}
              />
            ) : null}
          </div>
        );
      })}
    </div>
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
  inputRef,
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
  inputRef?: React.Ref<HTMLInputElement>;
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
          ref={inputRef}
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
