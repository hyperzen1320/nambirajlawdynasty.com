"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (!res || res.error) {
      setSubmitting(false);
      const code = (res as { code?: string } | null)?.code;
      if (code === "trial_expired") {
        setError(
          "Your chambers' trial has ended. Please ask your global admin to extend it or move to a paid plan."
        );
      } else if (code === "account_suspended") {
        setError(
          "This chambers has been suspended. Please contact Legalezi support."
        );
      } else if (code === "account_cancelled") {
        setError(
          "This chambers has been cancelled. Login is no longer available."
        );
      } else {
        setError(
          "These credentials don't match anyone in chambers. Check your email and password."
        );
      }
      return;
    }

    router.push("/post-login");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-7" noValidate>
      <Field
        id="email"
        label="Office Email"
        index="01"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={setEmail}
        placeholder="advocate@chambers.in"
      />

      <Field
        id="password"
        label="Password"
        index="02"
        type={showPw ? "text" : "password"}
        autoComplete="current-password"
        required
        value={password}
        onChange={setPassword}
        placeholder="••••••••"
        right={
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-soft transition-colors hover:text-ink"
            >
              {showPw ? "Hide" : "Show"}
            </button>
            <span className="text-rule">·</span>
            <Link
              href="/forgot-password"
              className="font-mono text-[10px] uppercase tracking-[0.18em] text-brass-deep transition-colors hover:text-ink"
            >
              Forgot?
            </Link>
          </div>
        }
      />

      <label className="flex cursor-pointer items-center gap-3 select-none">
        <span className="relative inline-flex h-4 w-4 items-center justify-center">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="peer sr-only"
          />
          <span className="absolute inset-0 border border-ink/40 transition-colors peer-checked:border-ink peer-checked:bg-ink" />
          <svg
            viewBox="0 0 16 16"
            className="relative h-3 w-3 text-paper opacity-0 transition-opacity peer-checked:opacity-100"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path d="M3 8 L7 12 L13 4" strokeLinecap="square" strokeLinejoin="miter" />
          </svg>
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-2">
          Remember this device
        </span>
      </label>

      {error && (
        <div className="border border-vermillion/40 bg-vermillion/5 px-4 py-3">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-vermillion">
            <span>✗</span>
            <span>Notice from the bench</span>
          </div>
          <p className="mt-2 font-body text-[14px] italic leading-7 text-ink-2">
            {error}
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="group relative inline-flex w-full items-center justify-center gap-3 border border-ink bg-ink px-7 py-4 font-mono text-[12px] uppercase tracking-[0.18em] text-paper transition-colors hover:bg-ink-2 disabled:opacity-70"
      >
        {submitting ? (
          <span className="inline-flex items-center gap-2">
            <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-brass" />
            <span>Authenticating…</span>
          </span>
        ) : (
          <>
            Sign In
            <span className="text-brass transition-transform duration-200 group-hover:translate-x-1">
              →
            </span>
          </>
        )}
      </button>
    </form>
  );
}

function Field({
  id,
  label,
  index,
  type = "text",
  required,
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
  required?: boolean;
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
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="peer w-full bg-transparent px-0 py-2.5 font-body text-[18px] text-ink placeholder:text-ink-soft/40 outline-none"
        />
        {/* base underline */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-ink/25 transition-colors peer-focus:bg-ink/50" />
        {/* brass focus stroke */}
        <div className="absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 bg-brass transition-transform duration-300 peer-focus:scale-x-100" />
      </div>
    </div>
  );
}
